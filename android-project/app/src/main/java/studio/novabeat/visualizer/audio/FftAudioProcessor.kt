package studio.novabeat.visualizer.audio

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

data class AudioSpectrumFrame(
    val bass: Float = 0f,
    val mid: Float = 0f,
    val treble: Float = 0f,
    val spectrum: FloatArray = FloatArray(64),
    val waveform: FloatArray = FloatArray(96)
)

class FftAudioProcessor : BaseAudioProcessor() {
    private val fftSize = 1024
    private val pcmRing = FloatArray(fftSize)
    private val real = FloatArray(fftSize)
    private val imag = FloatArray(fftSize)
    private val hannWindow = FloatArray(fftSize) { i ->
        (0.5f * (1f - cos(2.0 * PI * i / (fftSize - 1)))).toFloat()
    }
    private var writePos = 0

    private val _spectrumFlow = MutableStateFlow(AudioSpectrumFrame())
    val spectrumFlow: StateFlow<AudioSpectrumFrame> = _spectrumFlow

    override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
            throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
        }
        return inputAudioFormat
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val remaining = inputBuffer.remaining()
        if (remaining == 0) return

        val outputBuffer = replaceOutputBuffer(remaining)
        val duplicate = inputBuffer.duplicate().order(ByteOrder.nativeOrder())

        while (duplicate.remaining() >= 2) {
            val sample = duplicate.short / 32768f
            pcmRing[writePos] = sample
            writePos = (writePos + 1) % fftSize
            if (writePos == 0) {
                computeFftFrame()
            }
        }

        outputBuffer.put(inputBuffer)
        outputBuffer.flip()
    }

    private fun computeFftFrame() {
        for (i in 0 until fftSize) {
            real[i] = pcmRing[i] * hannWindow[i]
            imag[i] = 0f
        }
        var j = 0
        for (i in 0 until fftSize) {
            if (i < j) {
                val tr = real[i]; real[i] = real[j]; real[j] = tr
                val ti = imag[i]; imag[i] = imag[j]; imag[j] = ti
            }
            var m = fftSize shr 1
            while (m >= 1 && j >= m) { j -= m; m = m shr 1 }
            j += m
        }
        var s = 1
        while ((1 shl s) <= fftSize) {
            val m = 1 shl s
            val halfM = m shr 1
            val theta = -2.0 * PI / m
            val wStepR = cos(theta).toFloat()
            val wStepI = sin(theta).toFloat()
            for (k in 0 until fftSize step m) {
                var wR = 1f; var wI = 0f
                for (mIdx in 0 until halfM) {
                    val i1 = k + mIdx
                    val i2 = i1 + halfM
                    val tR = wR * real[i2] - wI * imag[i2]
                    val tI = wR * imag[i2] + wI * real[i2]
                    real[i2] = real[i1] - tR
                    imag[i2] = imag[i1] - tI
                    real[i1] += tR
                    imag[i1] += tI
                    val nextWR = wR * wStepR - wI * wStepI
                    wI = wR * wStepI + wI * wStepR
                    wR = nextWR
                }
            }
            s++
        }
        val bars = FloatArray(64)
        val scale = 2f / fftSize
        for (b in 0 until 64) {
            val mag = hypot(real[b + 1], imag[b + 1]) * scale * 8f
            bars[b] = mag.coerceIn(0f, 1f)
        }
        val bass = bars.sliceArray(0..11).average().toFloat()
        val mid = bars.sliceArray(12..39).average().toFloat()
        val treble = bars.sliceArray(40..63).average().toFloat()
        _spectrumFlow.value = AudioSpectrumFrame(bass, mid, treble, bars, pcmRing.copyOf(96))
    }
}
