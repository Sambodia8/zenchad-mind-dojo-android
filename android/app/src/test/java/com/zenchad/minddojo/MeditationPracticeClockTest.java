package com.zenchad.minddojo;
import org.junit.Test;
import static org.junit.Assert.*;
public class MeditationPracticeClockTest {
    @Test public void pausedTimeIsExcludedAndResumeIncludesPriorPractice() {
        assertEquals(13000, MeditationPracticeClock.elapsed(0,1000,14000,true,793000));
        assertEquals(13000, MeditationPracticeClock.elapsed(13000,14000,254000,false,793000));
        assertEquals(793000, MeditationPracticeClock.elapsed(13000,254000,1034000,true,793000));
    }
    @Test public void sleepAndProcessRecreationUseTheSameMonotonicAnchor() {
        assertEquals(780000, MeditationPracticeClock.elapsed(0,20000,900000,true,780000));
        assertEquals(900000, MeditationPracticeClock.elapsed(10000,20000,910000,true,0));
    }
    @Test public void completedTargetsCannotAccumulateExtraTime() {
        assertEquals(60000, MeditationPracticeClock.elapsed(60000,1000,900000,true,60000));
        assertEquals(59000, MeditationPracticeClock.elapsed(59000,1000,1000,false,0));
    }
}
