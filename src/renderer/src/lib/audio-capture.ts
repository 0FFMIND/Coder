let mediaStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let processor: ScriptProcessorNode | null = null

export async function startAudioCapture(deviceId?: string): Promise<void> {
  let stream: MediaStream

  if (deviceId) {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        sampleRate: 16000,
        channelCount: 1
      },
      video: false
    })
  } else {
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true
    })
    stream.getVideoTracks().forEach((t) => t.stop())
  }

  mediaStream = stream

  audioContext = new AudioContext({ sampleRate: 16000 })
  const source = audioContext.createMediaStreamSource(new MediaStream(stream.getAudioTracks()))

  processor = audioContext.createScriptProcessor(2048, 1, 1)
  processor.onaudioprocess = (e) => {
    const float32 = e.inputBuffer.getChannelData(0)
    const int16 = new Int16Array(float32.length)
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    window.api.sendTranscriptionAudioChunk(int16.buffer)
  }
  source.connect(processor)
  processor.connect(audioContext.destination)
}

export function stopAudioCapture(): void {
  if (processor) {
    processor.disconnect()
    processor = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop())
    mediaStream = null
  }
}
