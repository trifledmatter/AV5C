import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

type ConnectionOptions = {
  port?: string;
  baudRate?: number;
  retries?: number;
};

/**
 * Responsible for managing the connection to the VEX device.
 *
 * @param options.port The port to connect to. Default: "/dev/ttyACM1"
 * @param options.baudRate The baud rate to use. Default: 115200
 * @param options.retries The number of times to retry the connection. Default: 3
 */
export default class {
  private port: string;
  private baudRate: number;
  private command: string;
  private retries: number;

  constructor(options?: ConnectionOptions) {
    this.port = options?.port ?? "/dev/ttyACM1";
    this.baudRate = options?.baudRate ?? 115200;
    this.command = "vex ping"; // we'll use this command to check if the device is connected
    this.retries = options?.retries ?? 3;
  }

  private openPort(port: SerialPort): Promise<void> {
    return new Promise((resolve, reject) => {
      port.open((err) => {
        if (err) {
          console.error(`[!] Failed to open port: ${err.message}`);
          reject(err);
        } else {
          console.log("Port opened successfully");
          resolve();
        }
      });
    });
  }

  private sendCommand(
    port: SerialPort,
    parser: ReadlineParser,
    command: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("No response within timeout period"));
      }, 5000);

      parser.on("data", (data) => {
        console.log(`[<] ${data.trim()}`);
        if (data.trim()) {
          clearTimeout(timeout);
          resolve(data.trim());
        }
      });

      port.write(command + "\n", (err) => {
        if (err) {
          console.error(`[!] Error writing to port: ${err.message}`);
          reject(err);
        } else {
          console.log(`[>] ${command}`);
        }
      });
    });
  }

  private closePort(port: SerialPort): Promise<void> {
    return new Promise((resolve, reject) => {
      port.close((err) => {
        if (err) {
          console.error(`[!] Error closing port: ${err.message}`);
          reject(err);
        } else {
          console.log("Port closed");
          resolve();
        }
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async connect(): Promise<boolean> {
    let isConnected = false;

    while (!isConnected) {
      console.log("Attempting to connect to the device...");

      const port = new SerialPort({
        path: this.port,
        baudRate: this.baudRate,
        autoOpen: false,
      });

      const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

      try {
        await this.openPort(port);
        const response = await this.sendCommand(port, parser, this.command);

        if (response) {
          console.log("Device is connected!");
          isConnected = true;
        }
      } catch (error) {
        console.error(`[!] Error during communication: ${error}`);
        console.log("Unable to connect. Retrying...");
        await this.delay(1000);
      } finally {
        await this.closePort(port);
      }
    }

    return isConnected;
  }

  public async send(command: string): Promise<string> {
    console.log(`[>] Sending command: ${command}`);

    const port = new SerialPort({
      path: this.port,
      baudRate: this.baudRate,
      autoOpen: false,
    });

    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

    try {
      await this.openPort(port);
      const response = await this.sendCommand(port, parser, command);
      return response;
    } catch (error) {
      console.error(`[!] Failed to send command: ${error}`);
      throw new Error(`[!] ${error}`);
    } finally {
      await this.closePort(port);
    }
  }
}
