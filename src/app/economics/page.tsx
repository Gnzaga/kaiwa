import ArticleList from '@/components/articles/ArticleList';

export default function EconomicsPage() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header className="watermark" data-kanji={'\u7D4C'}>
        <h1 className="text-2xl font-semibold text-text-primary relative z-10">
          <span className="font-jp text-accent-primary mr-2">{'\u7D4C\u6E08'}</span>
          <span className="text-text-secondary text-sm">Economics</span>
        </h1>
      </header>
      <ArticleList category="economics" />
    </div>
  );
}
