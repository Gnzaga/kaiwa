import ArticleList from '@/components/articles/ArticleList';

export default function LawPage() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Law</h1>
      </header>
      <ArticleList category="law" />
    </div>
  );
}
