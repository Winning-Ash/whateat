import { useState } from 'react';
import { logout, startKakaoLogin, withdrawAccount } from '../../../../api';
import kakaoLoginButton from '../../../../assets/Kakao Login/kakao_login_kr_medium.svg';
import { AuthUser } from '../../../../types';
import styles from './MoreTab.module.css';

interface MoreTabProps {
  user?: AuthUser;
  checkingSession: boolean;
  onLoggedOut(): void;
  onWithdrawn(): void;
}

export default function MoreTab({
  user,
  checkingSession,
  onLoggedOut,
  onWithdrawn,
}: MoreTabProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
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

  async function handleWithdrawal() {
    setWithdrawing(true);
    setErrorMessage(undefined);

    try {
      await withdrawAccount();
      onWithdrawn();
    } catch {
      setErrorMessage('회원탈퇴를 완료하지 못했습니다. 다시 시도해 주세요.');
      setWithdrawDialogOpen(false);
    } finally {
      setWithdrawing(false);
    }
  }

  if (checkingSession) {
    return <p className={styles.statusMessage} role="status">로그인 상태를 확인하고 있습니다.</p>;
  }

  if (user) {
    return (
      <section className={styles.accountSection} aria-labelledby="account-title">
        <div>
          <span className={styles.loginStatus}>로그인됨</span>
          <h2 id="account-title">{user.nickname}님</h2>
        </div>
        <div className={styles.accountActions}>
          <button
            className={styles.logoutButton}
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut || withdrawing}
          >
            {loggingOut ? '로그아웃 중...' : '로그아웃'}
          </button>
          <button
            className={styles.withdrawButton}
            type="button"
            onClick={() => setWithdrawDialogOpen(true)}
            disabled={loggingOut || withdrawing}
          >
            회원탈퇴
          </button>
        </div>
        {withdrawDialogOpen && (
          <section
            className={styles.withdrawConfirmation}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="withdraw-title"
            aria-describedby="withdraw-description"
          >
            <h3 id="withdraw-title">정말 탈퇴하시겠습니까?</h3>
            <p id="withdraw-description">
              계정과 좋아요·싫어요 목록이 삭제되며 카카오 연결도 해제됩니다.
            </p>
            <div>
              <button
                type="button"
                onClick={() => setWithdrawDialogOpen(false)}
                disabled={withdrawing}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleWithdrawal()}
                disabled={withdrawing}
              >
                {withdrawing ? '탈퇴 처리 중...' : '회원탈퇴'}
              </button>
            </div>
          </section>
        )}
        {errorMessage && <p className={styles.errorMessage} role="alert">{errorMessage}</p>}
      </section>
    );
  }

  return (
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
}
