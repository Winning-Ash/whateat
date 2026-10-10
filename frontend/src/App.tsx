import { useState } from 'react';
import MainPage from './pages/MainPage/MainPage';
import {
  applyPinColor,
  applyTheme,
  getSavedPinColor,
  getSavedTheme,
  savePinColor,
  saveTheme,
  type PinColorId,
  type ThemeId,
} from './styles/theme';

export default function App() {
  const [theme, setTheme] = useState<ThemeId>(getSavedTheme);
  const [pinColor, setPinColor] = useState<PinColorId>(getSavedPinColor);

  function changeTheme(nextTheme: ThemeId) {
    applyTheme(nextTheme);
    setTheme(nextTheme);
    saveTheme(nextTheme);
  }

  function changePinColor(nextPinColor: PinColorId) {
    applyPinColor(nextPinColor);
    setPinColor(nextPinColor);
    savePinColor(nextPinColor);
  }

  return (
    <MainPage
      theme={theme}
      pinColor={pinColor}
      onThemeChange={changeTheme}
      onPinColorChange={changePinColor}
    />
  );
}
