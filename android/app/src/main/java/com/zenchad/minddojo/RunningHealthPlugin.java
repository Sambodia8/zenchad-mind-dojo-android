package com.zenchad.minddojo;

import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@CapacitorPlugin(
    name = "RunningHealth",
    permissions = {
        @Permission(
            alias = "health",
            strings = {
                "android.permission.health.READ_HEART_RATE",
                "android.permission.health.READ_STEPS"
            }
        )
    }
)
public class RunningHealthPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ExecutorService callbacks = Executors.newCachedThreadPool();

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void requestHealthPermissions(PluginCall call) {
        if (!isSupported()) {
            call.resolve(status());
            return;
        }
        if (getPermissionState("health") == PermissionState.GRANTED) {
            call.resolve(status());
            return;
        }
        requestPermissionForAlias("health", call, "healthPermissionsCallback");
    }

    @PermissionCallback
    private void healthPermissionsCallback(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void readRunHealth(PluginCall call) {
        if (!isSupported()) {
            call.reject("Health Connect records require Android 14 or newer.");
            return;
        }
        if (getPermissionState("health") != PermissionState.GRANTED) {
            call.reject("Health Connect heart-rate and steps permission has not been granted.");
            return;
        }
        Long startedAt = call.getLong("startedAt");
        Long endedAt = call.getLong("endedAt");
        if (startedAt == null || endedAt == null || endedAt <= startedAt) {
            call.reject("A valid run start and end time is required.");
            return;
        }

        worker.execute(() -> {
            try {
                Instant start = Instant.ofEpochMilli(startedAt);
                Instant end = Instant.ofEpochMilli(endedAt);
                List<?> heartRecords = readRecords("android.health.connect.datatypes.HeartRateRecord", start, end);
                List<?> stepRecords = readRecords("android.health.connect.datatypes.StepsRecord", start, end);
                List<?> cadenceRecords;
                try {
                    cadenceRecords = readRecords("android.health.connect.datatypes.StepsCadenceRecord", start, end);
                } catch (Throwable ignored) {
                    cadenceRecords = new ArrayList<>();
                }
                call.resolve(buildHealthResult(heartRecords, stepRecords, cadenceRecords));
            } catch (Throwable error) {
                call.reject("Could not read Health Connect records: " + safeMessage(error));
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        worker.shutdownNow();
        callbacks.shutdownNow();
        super.handleOnDestroy();
    }

    private JSObject status() {
        JSObject result = new JSObject();
        result.put("supported", isSupported());
        result.put("permissionGranted", isSupported() && getPermissionState("health") == PermissionState.GRANTED);
        result.put("source", "Health Connect");
        return result;
    }

    private boolean isSupported() {
        if (Build.VERSION.SDK_INT < 34) return false;
        try {
            Object serviceName = android.content.Context.class.getField("HEALTH_CONNECT_SERVICE").get(null);
            if (!(serviceName instanceof String)) return false;
            return getContext().getSystemService((String) serviceName) != null;
        } catch (Throwable ignored) {
            return false;
        }
    }

    private Object manager() throws Exception {
        Object serviceName = android.content.Context.class.getField("HEALTH_CONNECT_SERVICE").get(null);
        Object manager = getContext().getSystemService((String) serviceName);
        if (manager == null) throw new IllegalStateException("Health Connect service is unavailable");
        return manager;
    }

    private List<?> readRecords(String recordClassName, Instant start, Instant end) throws Exception {
        Class<?> recordClass = Class.forName(recordClassName);
        Class<?> timeRangeInterface = Class.forName("android.health.connect.TimeRangeFilter");
        Class<?> timeRangeBuilderClass = Class.forName("android.health.connect.TimeInstantRangeFilter$Builder");
        Object timeRangeBuilder = timeRangeBuilderClass.getConstructor().newInstance();
        timeRangeBuilderClass.getMethod("setStartTime", Instant.class).invoke(timeRangeBuilder, start);
        timeRangeBuilderClass.getMethod("setEndTime", Instant.class).invoke(timeRangeBuilder, end);
        Object timeRange = timeRangeBuilderClass.getMethod("build").invoke(timeRangeBuilder);

        Class<?> builderClass = Class.forName("android.health.connect.ReadRecordsRequestUsingFilters$Builder");
        Constructor<?> constructor = builderClass.getConstructor(Class.class);
        Object builder = constructor.newInstance(recordClass);
        Method setTimeRange = builderClass.getMethod("setTimeRangeFilter", timeRangeInterface);
        setTimeRange.invoke(builder, timeRange);
        Object request = builderClass.getMethod("build").invoke(builder);

        Class<?> outcomeReceiverClass = Class.forName("android.os.OutcomeReceiver");
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<Object> response = new AtomicReference<>();
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Object receiver = Proxy.newProxyInstance(
            outcomeReceiverClass.getClassLoader(),
            new Class<?>[] { outcomeReceiverClass },
            (proxy, method, args) -> {
                if ("onResult".equals(method.getName())) response.set(args == null || args.length == 0 ? null : args[0]);
                if ("onError".equals(method.getName()) && args != null && args.length > 0 && args[0] instanceof Throwable) {
                    failure.set((Throwable) args[0]);
                }
                latch.countDown();
                return null;
            }
        );

        Object healthManager = manager();
        Method readMethod = null;
        for (Method method : healthManager.getClass().getMethods()) {
            if ("readRecords".equals(method.getName()) && method.getParameterTypes().length == 3) {
                readMethod = method;
                break;
            }
        }
        if (readMethod == null) throw new NoSuchMethodException("HealthConnectManager.readRecords");
        readMethod.invoke(healthManager, request, callbacks, receiver);
        if (!latch.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Health Connect read timed out");
        Throwable readFailure = failure.get();
        if (readFailure != null) {
            if (readFailure instanceof Exception) throw (Exception) readFailure;
            throw new RuntimeException(readFailure);
        }
        Object result = response.get();
        if (result == null) return new ArrayList<>();
        Object records = result.getClass().getMethod("getRecords").invoke(result);
        return records instanceof List ? (List<?>) records : new ArrayList<>();
    }

    private JSObject buildHealthResult(List<?> heartRecords, List<?> stepRecords, List<?> cadenceRecords) throws Exception {
        JSObject result = new JSObject();
        JSArray heartSamples = new JSArray();
        double heartTotal = 0d;
        double heartMin = Double.POSITIVE_INFINITY;
        double heartMax = 0d;
        int heartCount = 0;

        for (Object record : heartRecords) {
            Object samplesObject = record.getClass().getMethod("getSamples").invoke(record);
            if (!(samplesObject instanceof List)) continue;
            for (Object sample : (List<?>) samplesObject) {
                double bpm = numberFrom(sample, "getBeatsPerMinute", 0d);
                long at = instantMillisFrom(sample, "getTime");
                if (bpm <= 0d || at <= 0L) continue;
                heartTotal += bpm;
                heartMin = Math.min(heartMin, bpm);
                heartMax = Math.max(heartMax, bpm);
                heartCount += 1;
                JSObject point = new JSObject();
                point.put("at", at);
                point.put("bpm", bpm);
                heartSamples.put(point);
            }
        }

        long steps = 0L;
        for (Object record : stepRecords) {
            steps += Math.max(0L, longFrom(record, "getCount", 0L));
        }

        JSArray cadenceSamples = new JSArray();
        double cadenceTotal = 0d;
        double cadenceMax = 0d;
        int cadenceCount = 0;
        for (Object record : cadenceRecords) {
            Object samplesObject = record.getClass().getMethod("getSamples").invoke(record);
            if (!(samplesObject instanceof List)) continue;
            for (Object sample : (List<?>) samplesObject) {
                double rate = numberFrom(sample, "getRate", 0d);
                long at = instantMillisFrom(sample, "getTime");
                if (rate <= 0d || at <= 0L) continue;
                cadenceTotal += rate;
                cadenceMax = Math.max(cadenceMax, rate);
                cadenceCount += 1;
                JSObject point = new JSObject();
                point.put("at", at);
                point.put("stepsPerMinute", rate);
                cadenceSamples.put(point);
            }
        }

        result.put("heartRateSamples", heartSamples);
        result.put("heartRateSampleCount", heartCount);
        result.put("averageHeartRate", heartCount == 0 ? null : heartTotal / heartCount);
        result.put("minimumHeartRate", heartCount == 0 ? null : heartMin);
        result.put("maximumHeartRate", heartCount == 0 ? null : heartMax);
        result.put("steps", steps);
        result.put("cadenceSamples", cadenceSamples);
        result.put("cadenceSampleCount", cadenceCount);
        result.put("averageCadence", cadenceCount == 0 ? null : cadenceTotal / cadenceCount);
        result.put("maximumCadence", cadenceCount == 0 ? null : cadenceMax);
        return result;
    }

    private double numberFrom(Object object, String methodName, double fallback) {
        try {
            Object value = object.getClass().getMethod(methodName).invoke(object);
            return value instanceof Number ? ((Number) value).doubleValue() : fallback;
        } catch (Throwable ignored) {
            return fallback;
        }
    }

    private long longFrom(Object object, String methodName, long fallback) {
        try {
            Object value = object.getClass().getMethod(methodName).invoke(object);
            return value instanceof Number ? ((Number) value).longValue() : fallback;
        } catch (Throwable ignored) {
            return fallback;
        }
    }

    private long instantMillisFrom(Object object, String methodName) {
        try {
            Object value = object.getClass().getMethod(methodName).invoke(object);
            return value instanceof Instant ? ((Instant) value).toEpochMilli() : 0L;
        } catch (Throwable ignored) {
            return 0L;
        }
    }

    private String safeMessage(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null) current = current.getCause();
        String message = current.getMessage();
        return message == null || message.trim().isEmpty() ? current.getClass().getSimpleName() : message;
    }
}
