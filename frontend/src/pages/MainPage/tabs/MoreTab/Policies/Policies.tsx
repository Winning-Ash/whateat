import { ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';
import terms from '../../../../../content/policies/terms.md?raw';
import privacy from '../../../../../content/policies/privacy.md?raw';
import menuStyles from '../MoreTab.module.css';
import styles from './Policies.module.css';

const POLICY_DOCUMENTS = {
  terms: { title: '이용 약관', content: terms },
  privacy: { title: '개인 정보 처리 방침', content: privacy },
} as const;

type PolicyDocument = keyof typeof POLICY_DOCUMENTS;

interface PoliciesProps {
  page: 'policies' | PolicyDocument;
  onSelectDocument(document: PolicyDocument): void;
}

export default function Policies({ page, onSelectDocument }: PoliciesProps) {
  if (page === 'policies') {
    return (
      <nav className={menuStyles.menuItems} aria-label="약관 및 정책">
        {(['terms', 'privacy'] as const).map((document) => (
          <button
            key={document}
            className={menuStyles.menuItem}
            type="button"
            onClick={() => onSelectDocument(document)}
          >
            <span>{POLICY_DOCUMENTS[document].title}</span>
            <ChevronRight aria-hidden="true" />
          </button>
        ))}
      </nav>
    );
  }

  const document = POLICY_DOCUMENTS[page];

  return (
    <article className={styles.document} aria-label={document.title}>
      <Markdown skipHtml>{document.content}</Markdown>
    </article>
  );
}
