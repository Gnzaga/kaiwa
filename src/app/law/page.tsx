import ArticleList from '@/components/articles/ArticleList';

export default function LawPage() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header className="watermark" data-kanji={'\u6CD5'}>
        <h1 className="text-2xl font-semibold text-text-primary relative z-10">
          <span className="font-jp text-accent-primary mr-2">{'\u6CD5\u5F8B'}</span>
          <span className="text-text-secondary text-sm">Law</span>
        </h1>
      </header>
      <ArticleList category="law" />
    </div>
  );
}
