import os from 'os';
import crypto from 'crypto';
import { customAlphabet } from 'nanoid';
import _ from 'lodash';
import { isAxiosError } from 'axios';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger.service';
import { Environment, EnvironmentVariables, Row, UserType } from '../types';
import moment from 'moment';

export const columnNumberMapping: { [key: string]: number[] } = {
  '0': [1, 9],
  '1': [10, 19],
  '2': [20, 29],
  '3': [30, 39],
  '4': [40, 49],
  '5': [50, 59],
  '6': [60, 69],
  '7': [70, 79],
  '8': [80, 90],
};
type Range = [number, number];

const valueRanges: Range[] = [
  [1, 9],
  [10, 19],
  [20, 29],
  [30, 39],
  [40, 49],
  [50, 59],
  [60, 69],
  [70, 79],
  [80, 90],
];
@Injectable()
export class UtilsService {
  private readonly logger = new LoggerService();

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  isProduction(): boolean {
    return this.configService.get('NODE_ENV') === Environment.Production;
  }

  isProductionApp(): boolean {
    if (this.isProduction()) {
      return this.configService.get('APP_ENV') === Environment.Production;
    }
    return false;
  }

  getCookiePrefix(ut: UserType) {
    if (!this.isProduction() || this.isProductionApp()) {
      return `__${ut}__`;
    } else {
      return `${this.configService.get('APP_ENV')}__${ut}__`;
    }
  }

  generateSalt(length = 16): string {
    return crypto.randomBytes(length).toString('hex');
  }

  hashPassword(data: string, salt: string, length: number): string {
    return crypto.scryptSync(data, salt, length).toString('hex');
  }

  generateRandomToken(length?: number): string {
    const alphabet =
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const nanoid = customAlphabet(alphabet);
    return nanoid(length);
  }

  toEnumValue<T extends Record<string, string>>(
    value: string | number,
    type: T,
    capitalize = true,
  ): keyof T {
    if (typeof value === 'string' && capitalize) {
      value = value
        .split('_')
        .map((part) => _.capitalize(part))
        .join('');
    }

    const possibleValues = Object.keys(type as Record<string, string>);
    if (possibleValues.includes(value.toString())) {
      return value as keyof T;
    }
    throw new Error(
      `Unknown enum value '${value}' found, possible values are ${possibleValues.toString()}`,
    );
  }

  exclude<T, Key extends keyof T>(
    obj: T,
    keys: Key[],
    enableClone = false,
  ): Omit<T, Key> {
    if (enableClone) {
      const clone = _.cloneDeep<T>(obj);
      for (const key of keys) {
        delete clone[key];
      }
      return clone;
    } else {
      for (const key of keys) {
        delete obj[key];
      }
      return obj;
    }
  }

  msToDay(ms: number): number {
    return Math.floor(ms / 86400000);
  }

  msToMin(ms: number): number {
    return Math.floor(ms / 60000);
  }

  msToHr(ms: number): number {
    return Math.floor(ms / 3600000);
  }

  msToSec(ms: number): number {
    return Math.floor(ms / 1000);
  }

  msToHuman(
    ms: number,
    options?: {
      maxUnit?: 'day' | 'hour' | 'minute' | 'second';
    },
  ): string {
    options = {
      maxUnit: options?.maxUnit || 'day',
    };

    const dateProperties: Record<string, number> = {};

    if (options.maxUnit === 'day') {
      dateProperties.day = this.msToDay(ms);
      dateProperties.hour = this.msToHr(ms) % 24;
      dateProperties.minute = this.msToMin(ms) % 60;
      dateProperties.second = this.msToSec(ms) % 60;
    }

    if (options.maxUnit === 'hour') {
      dateProperties.hour = this.msToHr(ms);
      dateProperties.minute = this.msToMin(ms) % 60;
      dateProperties.second = this.msToSec(ms) % 60;
    }

    if (options.maxUnit === 'minute') {
      dateProperties.minute = this.msToMin(ms);
      dateProperties.second = this.msToSec(ms) % 60;
    }

    if (options.maxUnit === 'second') {
      dateProperties.second = this.msToSec(ms);
    }

    return Object.entries(dateProperties)
      .filter((val) => val[1] !== 0)
      .map((val) => val[1] + ' ' + (val[1] !== 1 ? val[0] + 's' : val[0]))
      .join(', ');
  }

  async transform<T extends object, V>(
    cls: new (...args: any[]) => T,
    plain: V,
  ): Promise<T> {
    const instance = plainToInstance(cls, plain, {
      enableImplicitConversion: true,
    });
    await validateOrReject(instance, {
      whitelist: true,
      forbidUnknownValues: true,
    });
    return instance;
  }

  async sleep(ms: number) {
    return await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async waitUntilValue<T = any>(
    currentValue: T,
    targetValue: T,
    interval = 1000,
    timeout?: number,
  ): Promise<void> {
    const startTime = Date.now();

    while (
      typeof currentValue === 'function'
        ? currentValue() !== targetValue
        : currentValue !== targetValue
    ) {
      if (timeout && Date.now() - startTime > timeout) {
        throw new Error(
          `Timeout occurred while waiting for the "${currentValue}" to reach the target value ${targetValue}`,
        );
      }
      await this.sleep(interval);
    }
  }

  async rerunnable<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    backoff: { type: 'fixed' | 'exponential'; delay: number } = {
      type: 'exponential',
      delay: 1000,
    },
  ): Promise<T> {
    let attempt = 0;

    do {
      if (attempt > 0) {
        let delay = backoff.delay;
        if (backoff.type === 'exponential') {
          delay = backoff.delay * Math.pow(2, attempt - 2);
        }
        await this.sleep(delay);
      }

      try {
        return await fn();
      } catch (err) {
        if (attempt === maxRetries) {
          throw err;
        }
        attempt++;
      }
    } while (attempt <= maxRetries);

    throw new Error('Unexpected error occurred');
  }

  async retryable<T>(
    fn: () => Promise<T>,
    options?: {
      backoff?: { type: 'fixed' | 'exponential'; delay: number };
      silent?: boolean;
    },
  ): Promise<T> {
    const backoff = options?.backoff || {
      type: 'fixed',
      delay: 1000,
    };

    let attempt = 0;
    do {
      if (attempt > 0) {
        let delay = backoff.delay;
        if (backoff.type === 'exponential') {
          delay = backoff.delay * Math.pow(2, attempt - 2);
        }
        await this.sleep(delay);
      }

      try {
        return await fn();
      } catch (err) {
        if (!options?.silent) {
          if (isAxiosError(err)) {
            this.logger.error(err.toJSON());
          } else {
            this.logger.error(err);
          }
        }

        attempt++;
      }
    } while (true);
  }

  async occrunnable<T>(fn: () => Promise<T>): Promise<T> {
    do {
      try {
        return await fn();
      } catch (err) {
        if (err.code !== 'P2025') {
          throw err;
        }
      }
    } while (true);
  }

  async batchable<T, R>(
    elements: T[],
    fn: (element: T, index: number) => Promise<R>,
    batchSize = os.cpus().length * 4,
  ): Promise<R[]> {
    const results: R[] = [];
    const processes: Promise<void>[] = [];

    let currentIndex = 0;
    for (let i = 0; i < Math.min(batchSize, elements.length); i++) {
      const process = async () => {
        while (currentIndex < elements.length) {
          const index = currentIndex++;
          const element = elements[index];
          results[index] = await fn(element, index);
        }
      };
      processes.push(process());
    }

    // Wait for all processes to finish
    await Promise.all(processes);

    return results;
  }

  shuffleNumbers<T>(numbers: T[]): T[] {
    const shuffled = numbers.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  repeatedShuffle(numbers: number[], count: number) {
    let res: number[] = [];
    for (let i = 0; i < count; i++) {
      res = this.shuffleNumbers(numbers);
    }
    return res;
  }

  getRandomUniqueNumbers() {
    const array = Array.from({ length: 90 }, (_, i) => i + 1);
    return this.repeatedShuffle(array, 5);
  }

  getRandomIndex(min: number, max: number) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  getRandomElementFromArray(array: number[]) {
    const i = this.getRandomIndex(0, array.length - 1);
    return array[i];
  }

  ValidMatrix(numbers: number[][]) {
    if (numbers.length !== 3) {
      return false;
    }
    for (let i = 0; i < numbers.length; i++) {
      if (numbers[i].length !== 9) {
        return false;
      }
      const row: Row = numbers[i] as Row;
      for (let j = 0; j < row.length; j++) {
        const current = row[j];
        const validRange = columnNumberMapping[j.toString()];
        if (current >= validRange[0] && current <= validRange[1]) {
          continue;
        } else {
          return false;
        }
      }
    }
    return true;
  }
  parseBoolean(input: string | undefined): boolean | undefined {
    if (input === undefined) {
      return undefined;
    }

    const trimmedInput = input.trim().toLowerCase();

    if (trimmedInput === 'true') {
      return true;
    } else if (trimmedInput === 'false') {
      return false;
    } else {
      return undefined;
    }
  }

  formatNumberWithCommas(amount: number) {
    return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  convertToHexString(numbers: number[]): string {
    return numbers.map((num) => num.toString(16).padStart(2, '0')).join('');
  }

  getNthDateTime(DateTime: Date, nth: number) {
    const initialDateTime = new Date(DateTime);
    const interval = 30 * 1000;
    const desiredDateTime = new Date(
      initialDateTime.getTime() + (nth - 1) * interval,
    );
    const timeRemaining = this.getRemainingTimeInSeconds(desiredDateTime);
    return {
      desiredDateTime,
      timeRemaining: timeRemaining < 0 ? 0 : timeRemaining,
    };
  }
  getRemainingTimeInSeconds(nthDateTime: Date) {
    const now = new Date();
    const differenceInMilliseconds = nthDateTime.getTime() - now.getTime();
    const differenceInSeconds = Math.floor(differenceInMilliseconds / 1000);
    return differenceInSeconds;
  }

  counter(n = 30, stop: boolean) {
    let i = 1;
    const intervalId = setInterval(() => {
      console.log(i);
      i++;
      if (i > n) i = 1;
      // TODO
      // Replace with a condition
      if (stop) {
        clearInterval(intervalId);
      }
    }, 1000);
    return i;
  }

  getNumberFromRangeArray(start: number, end: number, exclude: number[] = []) {
    const arr = exclude.length
      ? this.generateRange(start, end).filter((n) => !exclude.includes(n))
      : this.generateRange(start, end);
    const idx = this.getRandomIndex(0, arr.length - 1);
    return arr[idx];
  }

  generateRange(start: number, end: number): number[] {
    return Array.from({ length: end - start + 1 }, (_, i) => i + start);
  }

  transformData(input: { sheet: any; sheetUid: any }) {
    const { sheet, sheetUid } = input;
    const _sheet = (sheet: any[][]) => ({
      sheet: sheet.map((t: any[]) => ({
        matrix: t.map((row) => ({
          row,
        })),
      })),
      uid: sheetUid,
    });
    return _sheet(sheet);
  }

  getCurrentWeekAndLastWeekDates() {
    const currentWeekStart = moment().startOf('week').add(1, 'day').toDate(); // Monday
    const currentWeekEnd = moment().endOf('week').add(1, 'day').toDate(); // Sunday

    const lastWeekStart = moment()
      .subtract(1, 'week')
      .startOf('week')
      .add(1, 'day')
      .toDate(); // Monday
    const lastWeekEnd = moment()
      .subtract(1, 'week')
      .endOf('week')
      .add(1, 'day')
      .toDate(); // Sunday
    return {
      currentWeek: [currentWeekStart, currentWeekEnd],
      prevWeek: [lastWeekStart, lastWeekEnd],
    };
  }

  // memoize expensive computations
  memoize<T extends (...args: any[]) => any>(fn: T): T {
    const cache: { [key: string]: ReturnType<T> } = {};

    return function (...args: Parameters<T>): ReturnType<T> {
      const key = JSON.stringify(args);
      if (key in cache) {
        console.log(`Cache hit for args: ${key}`);
        return cache[key];
      } else {
        console.log(`Cache miss for args: ${key}`);
        const result = fn(...args);
        cache[key] = result;
        return result;
      }
    } as T;
  }

  getAlternateChunks(
    numbers: number[],
    chunkSize: number = 2,
    skipSize: number = 2,
  ): number[][] {
    // chunkSize = 3 || this.getRandomIndex(2, 7);
    // skipSize = 3;
    const result = [];
    for (let i = 0; i < numbers.length; i += chunkSize + skipSize) {
      const chunk = numbers.slice(i, i + chunkSize);
      if (chunk.length > 0) {
        result.push(chunk);
      }
    }
    return result;
  }

  replaceFirstOccurrence(
    array: number[],
    target: number,
    replacement: number,
  ): number[] {
    const index = array.indexOf(target);
    return index !== -1
      ? [...array.slice(0, index), replacement, ...array.slice(index + 1)]
      : array;
  }

  ReplaceInPlace = (
    array: number[],
    target: number,
    replacement: number,
  ): number[] =>
    array.includes(target) && array.includes(replacement)
      ? ((array[array.indexOf(target)] = replacement),
        (array[array.indexOf(replacement)] = target),
        array)
      : array;

  getAlteredNumbersFromGame(
    array: number[],
    availableNumbers: number[],
    range: {
      start: number;
      end: number;
    },
  ) {
    let copy: number[] = [...array];
    array.slice(range.start, range.end).map((_, i) => {
      copy = this.ReplaceInPlace(copy, _, availableNumbers[i]);
    });
    return copy;
  }

  // TEST IF VALID HOUSE SHEET
  validHouseSheet(params: { sheet: number[][][]; numbers: number[] }) {
    const { sheet, numbers } = params;
    const ticket = sheet[0].flat(Infinity).filter(Boolean) as number[];
    const till45 = numbers.slice(0, 45);
    const houseRange = numbers.slice(49, 60);
    const houseNumbers = [...till45, ...houseRange];
    return ticket.every((n) => houseNumbers.includes(n));
  }

  // SHEET GENERATION LOGICS AND UTILS //
  /**
   * @description 
   * please make sure this algo should not violate these constraints if modified or extended.
   * ## Constraints
      - Each ticket has 3 rows with 9 columns each.
      - Each ticket contains 15 numbers.
      - Each row must have 5 numbers.
      - Each sheet should have 6 tickets that account for all 90 numbers.
      - When we talk about numbers in every ticket, they contain all unique numbers.
      - For each column in ticket, there can be a max of 3 numbers.
      - No ticket should have empty column / columns.
      - The numbers in every column must be sorted ascending. 
   * @author @hokamsingh
   **/
  generateTickets(count = 6, numbersToInclude: number[] = []): number[][][] {
    let occupiedNumbers: number[] = [];
    let attempts = 0;
    const allNumbers: number[] = Array.from(
      { length: 90 },
      (_, index) => index + 1,
    );

    const sets: number[][] = (() => {
      const allNumbersCopy = allNumbers.slice();
      const sets: number[][] = [];
      for (let i = 0; i < 9; i++) {
        if (i === 0) {
          sets.push(allNumbersCopy.splice(0, 9));
        } else if (i === 8) {
          sets.push(allNumbersCopy);
        } else {
          sets.push(allNumbersCopy.splice(0, 10));
        }
      }
      return sets;
    })();

    const getTickets = (retries: number = 100): number[][][] => {
      attempts = 0;
      retries -= 1;
      const tickets: number[][][] = Array.from({ length: count }, () =>
        Array.from({ length: 3 }, () => Array(9).fill(0)),
      ); // ZERO FILLED TICKETS
      const generatedTickets: number[][][] = tickets.map((ticket, index) => {
        if (tickets.length - 1 === index) {
          // PUT ALL REMAINING NUMBER NOT PICKED IF LAST INDEX
          const numbersSet = new Set(allNumbers);
          const occupiedNumbersSet = new Set(occupiedNumbers);
          const remainingNumbers = Array.from(
            new Set([...numbersSet].filter((x) => !occupiedNumbersSet.has(x))),
          ); // PUT ALL REMAINING NUMBER NOT PICKED
          ticket = getNewTicketFromList(remainingNumbers);
        } else if (index === 0 && numbersToInclude.length) {
          // Ensure the first ticket includes all the numbers to include
          ticket = getTicketWithSpecificNumbers(numbersToInclude) as number[][];
          // TODO experimental if not works remove later
          balanceTicketColumns(ticket, occupiedNumbers);
        } else {
          try {
            ticket = genRandomizedTicket();
          } catch (e) {
            console.error(e);
            return [];
          }
        }
        return ticket;
      });

      const validMatrixes = generatedTickets.map((ticket) =>
        validateTicket(ticket),
      );
      const isAnyInvalid = validMatrixes.filter(Boolean).length !== count;
      if (isAnyInvalid && retries > 0) {
        occupiedNumbers = [];
        return getTickets(retries);
      } else {
        if (
          generatedTickets.length >
          generatedTickets.flat(Infinity).filter((n: number) => n !== undefined)
            .length
        ) {
          return getTickets(retries);
        } else {
          return generatedTickets;
        }
      }
    };

    const genRandomizedTicket = () => {
      if (attempts === 100) {
        throw new Error("Can't generate ticket. Try again!");
      }
      attempts++;
      let ticket: number[][] = Array.from({ length: 3 }, () =>
        Array(9).fill(0),
      ); // EMPTY ZERO FILL TICKET
      const getTicketNumbersCount = (ticket: number[][]) =>
        ticket.flat().filter(Boolean).length;
      while (getTicketNumbersCount(ticket) < 15) {
        const randomNum: number = pickRandom();
        if (!ifTicketHasNumber(ticket, randomNum)) {
          const selectedRowIndex = getAvailableRowIndex(ticket);
          const belongingColumnIndex = getBelongingColumnIndex(randomNum); // NUMBER'S COLUMN ex for 32 it's 2 (0 based indexing)
          const canPlaceNumber = (
            ticket: number[][],
            rowIndex: number,
            colIndex: number,
          ) => {
            return !ticket[rowIndex][colIndex];
          };
          if (canPlaceNumber(ticket, selectedRowIndex, belongingColumnIndex)) {
            const placeNumber = (
              number: number,
              ticket: number[][],
              rowIndex: number,
              colIndex: number,
            ) => {
              ticket[rowIndex][colIndex] = number;
            };
            placeNumber(
              randomNum,
              ticket,
              selectedRowIndex,
              belongingColumnIndex,
            );
            occupiedNumbers.push(randomNum);
          }
        }
      }

      const isValid = validateTicket(ticket);
      if (isValid) {
        return ticket;
      } else {
        const ticketNumbers = ticket.flat();
        occupiedNumbers = occupiedNumbers.filter(
          (num) => !ticketNumbers.includes(num),
        );
        ticket = genRandomizedTicket();
        return ticket;
      }
    };

    const pickRandom = (): number => {
      const numbersSet = new Set(allNumbers);
      const occupiedNumbersSet = new Set(occupiedNumbers);
      const availableNumbers = Array.from(
        new Set([...numbersSet].filter((x) => !occupiedNumbersSet.has(x))),
      );
      return availableNumbers[
        Math.floor(Math.random() * availableNumbers.length)
      ];
    };

    const validateTicket = (ticket: number[][]) => {
      const count = getTicketNumbersCount(ticket);
      if (count !== 15) return false;
      const rowFault = ticket.find((row) => row.filter(Boolean).length !== 5);
      if (rowFault) return false;
      const columns: number[][] = [];
      for (let i = 0; i < 9; i++) {
        const column: number[] = ticket
          .map((row: number[]) => row[i])
          .filter(Boolean);
        columns.push(column);
      }
      const columnFault = columns.find((column) => column.length === 0);
      if (columnFault) return false;
      return true;
    };

    const ifTicketHasNumber = (ticket: number[][], number: number) => {
      return ticket.flat().includes(number);
    };

    const getAvailableRowIndex = (ticket: number[][]) => {
      const count = getTicketNumbersCount(ticket);
      if (count < 5) return 0;
      else if (count >= 5 && count < 10) return 1;
      else return 2;
    };

    const getTicketNumbersCount = (ticket: number[][]) => {
      return ticket.flat().filter(Boolean).length;
    };

    const getBelongingColumnIndex = (number: number) => {
      return sets.findIndex((set) => set.includes(number));
    };

    const canPlaceNumber = (
      ticket: number[][],
      rowIndex: number,
      colIndex: number,
    ) => {
      return !ticket[rowIndex][colIndex];
    };

    const getNewTicket = () => {
      return Array.from({ length: 3 }, () => Array(9).fill(0));
    };

    const getNewTicketFromList = (numbers: number[]) => {
      const ticket = getNewTicket();
      this.shuffleNumbers(numbers).forEach((number: number) => {
        let availableRowIndex = 0;
        for (let i = 0; i < 3; i++) {
          const columnIndex = getBelongingColumnIndex(number);
          if (ticket[i].filter(Boolean).length >= 5) continue;
          if (canPlaceNumber(ticket, i, columnIndex)) {
            availableRowIndex = i;
            ticket[availableRowIndex][columnIndex] = number;
            break;
          }
        }
      });
      return ticket;
    };

    const getTicketWithSpecificNumbers = (numbers: number[]): number[][] => {
      const ticket: number[][] = Array.from({ length: 3 }, () =>
        Array(9).fill(0),
      ); // EMPTY ZERO FILL TICKET
      this.shuffleNumbers(numbers.slice(0, 40)).forEach((number) => {
        const belongingColumnIndex = getBelongingColumnIndex(number);
        for (let i = 0; i < 3; i++) {
          if (ticket[i].filter(Boolean).length < 5) {
            if (canPlaceNumber(ticket, i, belongingColumnIndex)) {
              ticket[i][belongingColumnIndex] = number;
              occupiedNumbers.push(number);
              break;
            }
          }
        }
      });

      // Fill the rest of the ticket with random numbers
      while (getTicketNumbersCount(ticket) < 15) {
        const randomNum: number = pickRandom();
        if (!ifTicketHasNumber(ticket, randomNum)) {
          const selectedRowIndex = getAvailableRowIndex(ticket);
          const belongingColumnIndex = getBelongingColumnIndex(randomNum);
          if (canPlaceNumber(ticket, selectedRowIndex, belongingColumnIndex)) {
            ticket[selectedRowIndex][belongingColumnIndex] = randomNum;
            occupiedNumbers.push(randomNum);
          }
        }
      }

      return ticket;
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const balanceTicketColumns = (ticket: number[][], used: number[]): void => {
      const emptyColumns = Array.from(
        { length: ticket[0].length },
        (_, i) => i,
      ).filter((i) => ticket.every((row) => row[i] === 0));

      const filledColumns = Array.from(
        { length: ticket[0].length },
        (_, i) => i,
      ).filter((i) => ticket.every((row) => row[i] > 0));

      emptyColumns.forEach((emptyColIndex) => {
        if (filledColumns.length === 0) return;

        const filledColIndex = filledColumns.pop()!;

        for (let rowIndex = 0; rowIndex < ticket.length; rowIndex++) {
          if (ticket[rowIndex][filledColIndex] > 0) {
            const valueToMove = ticket[rowIndex][filledColIndex];
            ticket[rowIndex][filledColIndex] = 0;
            used.splice(used.indexOf(valueToMove), 1);
            for (
              let targetRowIndex = 0;
              targetRowIndex < ticket.length;
              targetRowIndex++
            ) {
              if (
                ticket[targetRowIndex][emptyColIndex] === 0 &&
                ticket[targetRowIndex].filter((v) => v !== 0).length < 5
              ) {
                let randomNumber = this.getRandomElementFromArray(
                  numbersToInclude
                    .slice(0, this.getRandomIndex(40, 50))
                    .filter(
                      (i) =>
                        i >= valueRanges[emptyColIndex][0] &&
                        i <= valueRanges[emptyColIndex][1],
                    ),
                );
                let attempts = 10;
                while (randomNumber === undefined && attempts > 0) {
                  randomNumber = this.getRandomElementFromArray(
                    numbersToInclude
                      .slice(0, this.getRandomIndex(40, 50))
                      .filter(
                        (i) =>
                          i >= valueRanges[emptyColIndex][0] &&
                          i <= valueRanges[emptyColIndex][1],
                      ),
                  );
                  attempts--;
                }
                ticket[targetRowIndex][emptyColIndex] =
                  randomNumber === undefined ||
                  typeof randomNumber === 'undefined'
                    ? 0
                    : randomNumber;
                used.push(randomNumber);
                break;
              }
            }
            break;
          }
        }
      });

      ticket.forEach((row) => {
        const filledCells = row.filter((cell) => cell !== 0);
        const excess = filledCells.length - 5;

        if (excess > 0) {
          for (let i = 0; i < excess; i++) {
            const filledIndex = row.findIndex((cell) => cell !== 0);
            row[filledIndex] = 0;
          }
        } else if (excess < 0) {
          for (let i = 0; i < -excess; i++) {
            const emptyIndex = row.findIndex((cell) => cell === 0);
            const colIndex = emptyIndex % ticket[0].length;
            row[emptyIndex] = this.getRandomElementFromArray(
              numbersToInclude
                .slice(0, this.getRandomIndex(40, 45))
                .filter(
                  (i) =>
                    i >= valueRanges[colIndex][0] &&
                    i <= valueRanges[colIndex][1],
                ),
            );
          }
        }
      });
    };

    return getTickets();
  }
}
