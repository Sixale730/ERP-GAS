// Web Serial API integration for USB/serial scales

// Web Serial API types (not in default TS DOM lib)
interface SerialPortOptions {
  baudRate: number
}

interface SerialPort {
  readable: ReadableStream | null
  writable: WritableStream | null
  open(options: SerialPortOptions): Promise<void>
  close(): Promise<void>
}

interface Serial {
  requestPort(): Promise<SerialPort>
}

declare global {
  interface Navigator {
    serial?: Serial
  }
}

type WeightCallback = (weight: number) => void

export class SerialScale {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<string> | null = null
  private callbacks: WeightCallback[] = []
  private buffer = ''
  private running = false

  get isConnected(): boolean {
    return this.port !== null && this.running
  }

  static get isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator
  }

  async connect(baudRate = 9600): Promise<boolean> {
    if (!SerialScale.isSupported) return false

    try {
      this.port = await navigator.serial!.requestPort()
      await this.port.open({ baudRate })
      this.running = true
      this.startReading()
      return true
    } catch {
      this.port = null
      return false
    }
  }

  async disconnect(): Promise<void> {
    this.running = false
    try {
      if (this.reader) {
        await this.reader.cancel()
        this.reader = null
      }
      if (this.port) {
        await this.port.close()
        this.port = null
      }
    } catch {
      this.port = null
      this.reader = null
    }
  }

  onWeightChange(callback: WeightCallback): () => void {
    this.callbacks.push(callback)
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback)
    }
  }

  async tare(): Promise<void> {
    if (!this.port?.writable) return
    const writer = this.port.writable.getWriter()
    try {
      // Common tare command (varies by scale brand)
      await writer.write(new TextEncoder().encode('T\r\n'))
    } finally {
      writer.releaseLock()
    }
  }

  private async startReading(): Promise<void> {
    if (!this.port?.readable) return

    const textDecoder = new TextDecoderStream()
    const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable)
    this.reader = textDecoder.readable.getReader()

    try {
      while (this.running) {
        const { value, done } = await this.reader.read()
        if (done) break
        if (value) {
          this.buffer += value
          this.processBuffer()
        }
      }
    } catch {
      // Port disconnected or error
    } finally {
      this.reader?.releaseLock()
      this.reader = null
      try {
        await readableStreamClosed
      } catch {
        // Ignore close errors
      }
    }
  }

  private processBuffer(): void {
    // Most scales send weight as ASCII lines: "  1.234 kg\r\n" or "1.234\r\n"
    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Extract numeric value, ignoring units
      const match = trimmed.match(/([\d.]+)/)
      if (match) {
        const weight = parseFloat(match[1])
        if (!isNaN(weight)) {
          this.callbacks.forEach(cb => cb(weight))
        }
      }
    }
  }
}
