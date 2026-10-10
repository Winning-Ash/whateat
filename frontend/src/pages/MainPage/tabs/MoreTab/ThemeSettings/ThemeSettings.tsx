import { useEffect, useRef, useState } from 'react';
import {
  getSavedCustomPinColor,
  getSavedCustomThemeColor,
  isCustomPinColor,
  isCustomTheme,
  PIN_COLORS,
  THEMES,
  type CustomPinColor,
  type CustomThemeColor,
  type PinColorId,
  type ThemeId,
} from '../../../../../styles/theme';
import styles from './ThemeSettings.module.css';

interface ThemeSettingsProps {
  theme: ThemeId;
  pinColor: PinColorId;
  onThemeChange(theme: ThemeId): void;
  onPinColorChange(pinColor: PinColorId): void;
}

export default function ThemeSettings({
  theme,
  pinColor,
  onThemeChange,
  onPinColorChange,
}: ThemeSettingsProps) {
  const [customColor, setCustomColor] = useState<CustomThemeColor>(() => (
    isCustomTheme(theme) ? theme : getSavedCustomThemeColor()
  ));
  const colorPickerRef = useRef<HTMLInputElement>(null);
  const [customPinColor, setCustomPinColor] = useState<CustomPinColor>(() => (
    isCustomPinColor(pinColor) ? pinColor : getSavedCustomPinColor()
  ));
  const pinColorPickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const picker = colorPickerRef.current;
    if (!picker) return;

    function commitCustomColor() {
      const nextColor = picker!.value;
      if (!isCustomTheme(nextColor)) return;
      setCustomColor(nextColor);
      onThemeChange(nextColor);
    }

    // 팔레트 이동 중 발생하는 input 대신 선택 확정 시의 change만 처리한다.
    picker.addEventListener('change', commitCustomColor);
    return () => picker.removeEventListener('change', commitCustomColor);
  }, [onThemeChange]);

  useEffect(() => {
    const picker = pinColorPickerRef.current;
    if (!picker) return;

    function commitCustomPinColor() {
      const nextColor = picker!.value;
      if (!isCustomPinColor(nextColor)) return;
      setCustomPinColor(nextColor);
      onPinColorChange(nextColor);
    }

    picker.addEventListener('change', commitCustomPinColor);
    return () => picker.removeEventListener('change', commitCustomPinColor);
  }, [onPinColorChange]);

  return (
    <section className={styles.settings} aria-label="테마 설정">
      <fieldset className={styles.colorSection}>
        <legend>테마 색상</legend>
        <div className={styles.options}>
          {THEMES.map((option) => (
            <label key={option.id} className={styles.option}>
              <input
                type="radio"
                name="theme"
                value={option.id}
                checked={theme === option.id}
                onChange={() => onThemeChange(option.id)}
              />
              <span className={styles.swatch} style={{ background: option.color }} aria-hidden="true" />
              <span>{option.name}</span>
            </label>
          ))}
          <label className={styles.option}>
            <input
              id="custom-theme-option"
              type="radio"
              name="theme"
              value="custom"
              checked={isCustomTheme(theme)}
              onChange={() => onThemeChange(customColor)}
              onClick={() => colorPickerRef.current?.showPicker()}
            />
            <span className={styles.swatch} style={{ background: customColor }} aria-hidden="true" />
            <span>커스텀</span>
          </label>
          <input
            ref={colorPickerRef}
            className={styles.colorPicker}
            type="color"
            aria-label="커스텀 테마 색상"
            tabIndex={-1}
            defaultValue={customColor}
          />
        </div>
      </fieldset>
      <fieldset className={styles.colorSection}>
        <legend>가게 핀 색상</legend>
        <div className={styles.options}>
          {PIN_COLORS.map((option) => (
            <label key={option.id} className={styles.option}>
              <input
                type="radio"
                name="pin-color"
                value={option.id}
                checked={pinColor === option.id}
                onChange={() => onPinColorChange(option.id)}
              />
              <span className={styles.pinPreview} style={{ background: option.color }} aria-hidden="true" />
              <span>{option.name}</span>
            </label>
          ))}
          <label className={styles.option}>
            <input
              id="custom-pin-color-option"
              type="radio"
              name="pin-color"
              value="custom"
              checked={isCustomPinColor(pinColor)}
              onChange={() => onPinColorChange(customPinColor)}
              onClick={() => pinColorPickerRef.current?.showPicker()}
            />
            <span className={styles.pinPreview} style={{ background: customPinColor }} aria-hidden="true" />
            <span>커스텀</span>
          </label>
          <input
            ref={pinColorPickerRef}
            className={styles.colorPicker}
            type="color"
            aria-label="커스텀 가게 핀 색상"
            tabIndex={-1}
            defaultValue={customPinColor}
          />
        </div>
      </fieldset>
    </section>
  );
}
