import { describe, it, expect } from '@jest/globals';

import {
  convertWeight,
  kgToDisplay,
  displayToKg,
  formatWeight,
  LB_TO_KG,
} from '../formatters.js';

describe('weight formatters', () => {
  describe('convertWeight', () => {
    it('passes through when the units are equal', () => {
      expect(convertWeight(135, 'lbs', 'lbs')).toBe(135);
      expect(convertWeight(61.2, 'kg', 'kg')).toBe(61.2);
    });

    it('converts lbs -> kg using the exact avoirdupois ratio', () => {
      expect(convertWeight(135, 'lbs', 'kg')).toBeCloseTo(135 * LB_TO_KG, 10);
      expect(convertWeight(100, 'lbs', 'kg')).toBeCloseTo(45.359237, 6);
    });

    it('converts kg -> lbs as the inverse ratio', () => {
      expect(convertWeight(45.359237, 'kg', 'lbs')).toBeCloseTo(100, 6);
    });

    it('round-trips through both units without drift', () => {
      const back = convertWeight(convertWeight(225, 'lbs', 'kg'), 'kg', 'lbs');
      expect(back).toBeCloseTo(225, 9);
    });

    it('throws on an unsupported conversion', () => {
      expect(() => convertWeight(1, 'lbs', 'miles')).toThrow(/unsupported conversion/);
    });
  });

  describe('kgToDisplay / displayToKg', () => {
    it('converts a canonical kg value to the display unit', () => {
      expect(kgToDisplay(45.359237, 'lbs')).toBeCloseTo(100, 6);
      expect(kgToDisplay(61.2, 'kg')).toBe(61.2);
    });

    it('converts a typed display value back to canonical kg', () => {
      expect(displayToKg(135, 'lbs')).toBeCloseTo(135 * LB_TO_KG, 10);
      expect(displayToKg(61.2, 'kg')).toBe(61.2);
    });

    it('round-trips display -> kg -> display', () => {
      const back = kgToDisplay(displayToKg(315, 'lbs'), 'lbs');
      expect(back).toBeCloseTo(315, 9);
    });
  });

  describe('formatWeight', () => {
    it('formats a kg value in the chosen unit with a clean label', () => {
      expect(formatWeight(45.359237, 'lbs')).toBe('100 lbs');
      expect(formatWeight(61.2349, 'kg')).toBe('61.2 kg');
    });

    it('drops a trailing .0 for whole numbers', () => {
      expect(formatWeight(0, 'kg')).toBe('0 kg');
      expect(formatWeight(45.359237, 'lbs')).toBe('100 lbs');
    });

    it('keeps one decimal for fractional values', () => {
      // 62.5 kg -> ~137.79 lbs -> 137.8 lbs
      expect(formatWeight(62.5, 'lbs')).toBe('137.8 lbs');
    });
  });
});