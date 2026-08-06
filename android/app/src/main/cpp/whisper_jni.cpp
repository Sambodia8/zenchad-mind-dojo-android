#include <jni.h>

#include <algorithm>
#include <cstring>
#include <cstdint>
#include <fstream>
#include <string>
#include <vector>

#include "whisper.h"

namespace {

void throw_java(JNIEnv *env, const char *message) {
    jclass exception = env->FindClass("java/lang/IllegalStateException");
    if (exception != nullptr) {
        env->ThrowNew(exception, message);
    }
}

uint16_t read_u16_le(const std::vector<uint8_t> &bytes, size_t offset) {
    return static_cast<uint16_t>(bytes[offset]) |
           (static_cast<uint16_t>(bytes[offset + 1]) << 8);
}

uint32_t read_u32_le(const std::vector<uint8_t> &bytes, size_t offset) {
    return static_cast<uint32_t>(bytes[offset]) |
           (static_cast<uint32_t>(bytes[offset + 1]) << 8) |
           (static_cast<uint32_t>(bytes[offset + 2]) << 16) |
           (static_cast<uint32_t>(bytes[offset + 3]) << 24);
}

std::vector<float> read_pcm16(const char *path) {
    std::ifstream input(path, std::ios::binary | std::ios::ate);
    if (!input) {
        return {};
    }

    const auto byte_count = input.tellg();
    if (byte_count <= 0) {
        return {};
    }

    input.seekg(0, std::ios::beg);
    std::vector<uint8_t> bytes(static_cast<size_t>(byte_count));
    input.read(reinterpret_cast<char *>(bytes.data()), static_cast<std::streamsize>(byte_count));

    size_t audio_offset = 0;
    size_t audio_bytes = bytes.size();
    if (bytes.size() >= 12 &&
        std::memcmp(bytes.data(), "RIFF", 4) == 0 &&
        std::memcmp(bytes.data() + 8, "WAVE", 4) == 0) {
        bool supported_format = false;
        bool found_data = false;
        size_t chunk_offset = 12;
        while (chunk_offset + 8 <= bytes.size()) {
            const uint32_t chunk_size = read_u32_le(bytes, chunk_offset + 4);
            const size_t content_offset = chunk_offset + 8;
            const size_t content_end = content_offset + chunk_size;
            if (content_end > bytes.size()) break;

            if (std::memcmp(bytes.data() + chunk_offset, "fmt ", 4) == 0 && chunk_size >= 16) {
                supported_format = read_u16_le(bytes, content_offset) == 1 &&
                                   read_u16_le(bytes, content_offset + 2) == 1 &&
                                   read_u32_le(bytes, content_offset + 4) == 16000 &&
                                   read_u16_le(bytes, content_offset + 14) == 16;
            } else if (std::memcmp(bytes.data() + chunk_offset, "data", 4) == 0) {
                audio_offset = content_offset;
                audio_bytes = chunk_size;
                found_data = true;
            }

            chunk_offset = content_end + (chunk_size % 2);
        }
        if (!supported_format || !found_data) return {};
    }

    const size_t sample_count = audio_bytes / sizeof(int16_t);
    std::vector<float> audio(sample_count);
    for (size_t index = 0; index < sample_count; ++index) {
        const uint16_t raw = read_u16_le(bytes, audio_offset + index * 2);
        audio[index] = static_cast<float>(static_cast<int16_t>(raw)) / 32768.0f;
    }
    return audio;
}

std::string trim(const std::string &value) {
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) {
        return {};
    }
    const auto last = value.find_last_not_of(" \t\r\n");
    return value.substr(first, last - first + 1);
}

}  // namespace

extern "C" JNIEXPORT jstring JNICALL
Java_com_zenchad_minddojo_WhisperJournalNative_transcribePcm(
        JNIEnv *env,
        jclass,
        jstring model_path_value,
        jstring pcm_path_value,
        jint requested_threads) {
    const char *model_path = env->GetStringUTFChars(model_path_value, nullptr);
    const char *pcm_path = env->GetStringUTFChars(pcm_path_value, nullptr);

    std::vector<float> audio = read_pcm16(pcm_path);
    if (audio.size() < 1600) {
        env->ReleaseStringUTFChars(model_path_value, model_path);
        env->ReleaseStringUTFChars(pcm_path_value, pcm_path);
        throw_java(env, "The recording was too short to transcribe.");
        return nullptr;
    }

    whisper_context_params context_params = whisper_context_default_params();
    context_params.use_gpu = false;
    whisper_context *context = whisper_init_from_file_with_params(model_path, context_params);

    env->ReleaseStringUTFChars(model_path_value, model_path);
    env->ReleaseStringUTFChars(pcm_path_value, pcm_path);

    if (context == nullptr) {
        throw_java(env, "Whisper could not load its local model.");
        return nullptr;
    }

    whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    params.language = "en";
    params.translate = false;
    params.n_threads = std::clamp(static_cast<int>(requested_threads), 1, 8);
    params.print_progress = false;
    params.print_realtime = false;
    params.print_timestamps = false;
    params.print_special = false;
    params.no_context = true;
    params.single_segment = false;
    params.suppress_blank = true;
    params.temperature = 0.0f;
    params.temperature_inc = 0.0f;
    params.initial_prompt = "Meditation journal reflection. Preserve names and natural conversational English.";

    const int result = whisper_full(
        context,
        params,
        audio.data(),
        static_cast<int>(audio.size())
    );

    if (result != 0) {
        whisper_free(context);
        throw_java(env, "Whisper could not transcribe this recording.");
        return nullptr;
    }

    std::string transcript;
    const int segment_count = whisper_full_n_segments(context);
    for (int index = 0; index < segment_count; ++index) {
        transcript += whisper_full_get_segment_text(context, index);
    }
    whisper_free(context);

    transcript = trim(transcript);
    return env->NewStringUTF(transcript.c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_zenchad_minddojo_WhisperJournalNative_systemInfo(JNIEnv *env, jclass) {
    return env->NewStringUTF(whisper_print_system_info());
}
