import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base64Int16ToFloat32,
  computeRmsLevel,
  float32ToInt16Base64,
  resampleFloat32,
  resolveOrbState,
  shouldTriggerBargeIn,
} from './roseAudioMath.ts';

test('PCM Float32 -> Int16 Base64 -> Float32 round-trip preserves waveform', () => {
  const original = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const encoded = float32ToInt16Base64(original);
  const decoded = base64Int16ToFloat32(encoded);

  assert.equal(decoded.length, original.length);
  for (let i = 0; i < original.length; i++) {
    assert.ok(Math.abs(decoded[i] - original[i]) < 0.001);
  }
});

test('resampleFloat32 downsamples 48kHz buffer to 16kHz at 1/3 length', () => {
  const input = new Float32Array(480);
  for (let i = 0; i < input.length; i++) {
    input[i] = Math.sin((i / 480) * Math.PI * 2);
  }
  const resampled = resampleFloat32(input, 48000, 16000);
  assert.equal(resampled.length, 160);
});

test('computeRmsLevel returns 0 for silence and capped <= 1 for loud signals', () => {
  assert.equal(computeRmsLevel(new Float32Array([0, 0, 0])), 0);
  assert.equal(computeRmsLevel(new Float32Array([1, -1, 1, -1])), 1);
});

test('shouldTriggerBargeIn requires consecutive loud frames while ROSE is speaking', () => {
  let frames = 0;
  for (let i = 0; i < 3; i++) {
    const res = shouldTriggerBargeIn({
      isRoseSpeaking: true,
      isMicMuted: false,
      inputRms: 0.2,
      consecutiveLoudFrames: frames,
      requiredFrames: 4,
    });
    assert.equal(res.interrupt, false);
    frames = res.nextLoudFrames;
  }
  const fourth = shouldTriggerBargeIn({
    isRoseSpeaking: true,
    isMicMuted: false,
    inputRms: 0.2,
    consecutiveLoudFrames: frames,
    requiredFrames: 4,
  });
  assert.equal(fourth.interrupt, true);

  // Muted mic never triggers barge-in
  const muted = shouldTriggerBargeIn({
    isRoseSpeaking: true,
    isMicMuted: true,
    inputRms: 0.9,
    consecutiveLoudFrames: 10,
  });
  assert.equal(muted.interrupt, false);
});

test('resolveOrbState prioritizes ERROR > DISCONNECTED > SPEAKING > THINKING > LISTENING > IDLE', () => {
  assert.equal(
    resolveOrbState({
      hasError: true,
      isConnected: true,
      isVoiceActive: true,
      isMuted: false,
      isThinking: true,
      isSpeaking: true,
    }),
    'ERROR'
  );
  assert.equal(
    resolveOrbState({
      hasError: false,
      isConnected: false,
      isVoiceActive: true,
      isMuted: false,
      isThinking: false,
      isSpeaking: false,
    }),
    'DISCONNECTED'
  );
  assert.equal(
    resolveOrbState({
      hasError: false,
      isConnected: true,
      isVoiceActive: true,
      isMuted: false,
      isThinking: true,
      isSpeaking: true,
    }),
    'SPEAKING'
  );
  assert.equal(
    resolveOrbState({
      hasError: false,
      isConnected: true,
      isVoiceActive: true,
      isMuted: false,
      isThinking: true,
      isSpeaking: false,
    }),
    'THINKING'
  );
  assert.equal(
    resolveOrbState({
      hasError: false,
      isConnected: true,
      isVoiceActive: true,
      isMuted: false,
      isThinking: false,
      isSpeaking: false,
    }),
    'LISTENING'
  );
  assert.equal(
    resolveOrbState({
      hasError: false,
      isConnected: true,
      isVoiceActive: false,
      isMuted: false,
      isThinking: false,
      isSpeaking: false,
    }),
    'IDLE'
  );
});
