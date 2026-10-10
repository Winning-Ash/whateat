import { useState } from 'react';
import { withdrawAccount } from '../../../../../api';
import styles from './AccountManagement.module.css';

interface AccountManagementProps {
  onWithdrawn(): void;
}

export default function AccountManagement({ onWithdrawn }: AccountManagementProps) {
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

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

  return (
    <section className={styles.accountManagement} aria-labelledby="withdraw-account-title">
      <div className={styles.withdrawArea}>
        <div>
          <h3 id="withdraw-account-title">회원탈퇴</h3>
        </div>
        <button
          className={styles.withdrawButton}
          type="button"
          onClick={() => setWithdrawDialogOpen(true)}
          disabled={withdrawing}
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
            계정과 저장된 정보가 모두 삭제되며 이는 되돌릴 수 없습니다.
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
