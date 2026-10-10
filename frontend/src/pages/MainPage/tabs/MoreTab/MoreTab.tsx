import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { logout, startKakaoLogin } from '../../../../api';
import kakaoLoginButton from '../../../../assets/Kakao Login/kakao_login_kr_medium.svg';
import { AuthUser } from '../../../../types';
import styles from './MoreTab.module.css';

interface MoreTabProps {
  onOpenAccountManagement(): void;
  onOpenThemeSettings(): void;
  user?: AuthUser;
  checkingSession: boolean;
  onLoggedOut(): void;
}

export default function MoreTab({
  onOpenAccountManagement,
  onOpenThemeSettings,
  user,
  checkingSession,
  onLoggedOut,
}: MoreTabProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleLogout() {
    setLoggingOut(true);
    setErrorMessage(undefined);

    try {
      await logout();
      onLoggedOut();
    } catch {
      setErrorMessage('로그아웃하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setLoggingOut(false);
    }
  }

  const accountContent = checkingSession ? (
    <p className={styles.statusMessage} role="status">로그인 상태를 확인하고 있습니다.</p>
  ) : user ? (
    <section className={styles.accountSection} aria-labelledby="account-title">
      <div className={styles.accountSummary}>
        <h2 id="account-title">{user.nickname}</h2>
        <div className={styles.accountActions}>
          <button
            className={styles.accountManagementButton}
            type="button"
            onClick={onOpenAccountManagement}
          >
            계정관리
            <ChevronRight aria-hidden="true" />
          </button>
          <button
            className={styles.logoutButton}
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            {loggingOut ? '로그아웃 중...' : '로그아웃'}
          </button>
        </div>
      </div>
      {errorMessage && <p className={styles.errorMessage} role="alert">{errorMessage}</p>}
    </section>
  ) : (
    <section className={styles.loginSection} aria-labelledby="login-title">
      <div className={styles.loginHeading}>
        <h2 id="login-title">로그인</h2>
      </div>
      <button
        className={styles.kakaoLoginButton}
        type="button"
        onClick={startKakaoLogin}
        aria-label="카카오 로그인"
      >
        <img src={kakaoLoginButton} alt="" />
      </button>
      {errorMessage && <p className={styles.errorMessage} role="alert">{errorMessage}</p>}
    </section>
  );

  return (
    <>
      {accountContent}
      <div className={styles.themeSettings}>
        <button className={styles.themeToggle} type="button" onClick={onOpenThemeSettings}>
          <span>테마 설정</span>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
