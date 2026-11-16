import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import menuStyles from '../MoreTab.module.css';
import styles from './Policies.module.css';

type PolicyDocument = 'terms' | 'privacy';

const policyFiles = import.meta.glob<string>(
  [
    '../../../../../content/policies/terms_*.md',
    '../../../../../content/policies/privacy_*.md',
  ],
  { query: '?raw', import: 'default' },
);

function getPolicyVersions(document: PolicyDocument) {
  const pattern = new RegExp(`/${document}_(\\d{8})\\.md$`);

  return Object.entries(policyFiles)
    .flatMap(([path, load]) => {
      const match = path.match(pattern);
      return match ? [{ path, date: match[1], load }] : [];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

const POLICY_DOCUMENTS = {
  terms: { title: '이용 약관', versions: getPolicyVersions('terms') },
  privacy: { title: '개인 정보 처리 방침', versions: getPolicyVersions('privacy') },
} as const;

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

  return <PolicyContent key={page} document={page} />;
}

function PolicyContent({ document }: { document: PolicyDocument }) {
  const { title, versions } = POLICY_DOCUMENTS[document];
  const [selectedPath, setSelectedPath] = useState(versions[0]?.path ?? '');
  const [loadedDocument, setLoadedDocument] = useState<{
    path: string;
    content: string | null;
  } | null>(null);
  const selectedVersion = versions.find((version) => version.path === selectedPath);

  useEffect(() => {
    if (!selectedVersion) return;

    let cancelled = false;

    selectedVersion.load().then(
      (content) => {
        if (!cancelled) setLoadedDocument({ path: selectedVersion.path, content });
      },
      () => {
        if (!cancelled) setLoadedDocument({ path: selectedVersion.path, content: null });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [selectedVersion]);

  return (
    <article className={styles.document} aria-label={title}>
      {!selectedVersion ? (
        <p role="status">등록된 문서가 없습니다.</p>
      ) : loadedDocument?.path !== selectedPath ? (
        <p role="status">문서를 불러오는 중입니다.</p>
      ) : loadedDocument.content === null ? (
        <p role="alert">문서를 불러오지 못했습니다. 다시 열어 주세요.</p>
      ) : (
        <Markdown
          skipHtml
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ children }) => (
              <div className={styles.tableWrapper} role="region" aria-label="문서 표" tabIndex={0}>
                <table>{children}</table>
              </div>
            ),
          }}
        >
          {loadedDocument.content}
        </Markdown>
      )}
      {versions.length > 0 && (
        <label className={styles.versionPicker}>
          <span>문서 버전</span>
          <select value={selectedPath} onChange={(event) => setSelectedPath(event.target.value)}>
            {versions.map((version, index) => (
              <option key={version.path} value={version.path}>
                {`${version.date.slice(0, 4)}-${version.date.slice(4, 6)}-${version.date.slice(6, 8)}${index === 0 ? ' (최신)' : ''}`}
              </option>
            ))}
          </select>
        </label>
      )}
    </article>
  );
}
