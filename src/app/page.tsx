"use client";

import { useEffect, useState, useCallback } from 'react';
import { Clock, ThumbsUp, Leaf, Zap, ExternalLink, ChefHat, Recycle, Sparkles, RefreshCw, Loader2, History, Users, Plus, Settings } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';

interface Recipe {
  id: string;
  title: string;
  url: string;
  source: string;
  cookingTime: number;
  tags: string[];
  ingredients: string;
  steps: string;
  nutrition: string;
  dishwashingTip: string;
  leftoverTip: string;
}

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showFeedback, setShowFeedback] = useState<string | null>(null);
  const [feedbackRecipe, setFeedbackRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('default');
  const [refinement, setRefinement] = useState("");
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [showUserAdmin, setShowUserAdmin] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [newUserName, setNewUserName] = useState("");
  const [knowledge, setKnowledge] = useState<{
    profile: string;
    preferences: string;
    recentTrends: string[];
    discoveryLog: { date: string; title: string; url: string; rating: number; note: string }[];
  } | null>(null);

  const fetchSuggestions = useCallback(async (query?: string) => {
    setGenerating(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('userId', userId);
      if (query) params.append('q', query);

      const res = await fetch(`/api/suggestions?${params.toString()}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setRecipes(data);
      }
    } catch (e) {
      setError('提案の取得に失敗しました。');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, [userId]);

  const fetchKnowledge = useCallback(async () => {
    try {
      const res = await fetch(`/api/knowledge?userId=${userId}`);
      const data = await res.json();
      setKnowledge(data);
    } catch (e) {
      console.error('Failed to fetch knowledge');
    }
  }, [userId]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error('Failed to fetch users');
    }
  }, []);

  const addUser = async () => {
    if (!newUserName.trim()) return;
    const id = newUserName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: newUserName }),
    });
    setNewUserName("");
    fetchUsers();
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const saved = localStorage.getItem('recipe_loop_user');
    if (saved) setUserId(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('recipe_loop_user', userId);
    setLoading(true);
    fetchSuggestions();
  }, [userId, fetchSuggestions]);

  const openFeedback = (recipe?: Recipe) => {
    if (recipe) {
      setFeedbackRecipe(recipe);
      setShowFeedback(recipe.id);
    } else {
      // Generic feedback
      setFeedbackRecipe({
        id: 'custom_' + Date.now(),
        title: "",
        url: "",
        source: "Manual Input",
        cookingTime: 0,
        tags: [],
        ingredients: "",
        steps: "",
        nutrition: "",
        dishwashingTip: "",
        leftoverTip: ""
      });
      setShowFeedback('custom');
    }
  };

  const handleFeedback = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!feedbackRecipe) return;
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        userId,
        recipeId: feedbackRecipe.id,
        recipeTitle: feedbackRecipe.title,
        recipeUrl: feedbackRecipe.url,
      }),
    });

    setShowFeedback(null);
    setFeedbackRecipe(null);
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
        <p className="text-lg font-light tracking-widest uppercase text-slate-400">Gemini がレシピを探索中...</p>
      </div>
    </div>
  );

  return (
    <AuthGuard>
      <main className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
        {/* Nav */}
        <nav className="border-b border-slate-800/50 bg-slate-950/80 px-6 py-4 backdrop-blur-xl sticky top-0 z-50">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                <ChefHat className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tighter text-white">
                RECIPE <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">LOOP</span>
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5">
                <Users className="h-4 w-4 text-slate-500" />
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-300 outline-none cursor-pointer"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button onClick={() => setShowUserAdmin(true)} className="ml-1 p-1 hover:text-indigo-400 transition-colors">
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={() => { fetchKnowledge(); setShowKnowledge(true); }}
                className="flex items-center gap-2 rounded-xl bg-indigo-950/30 border border-indigo-500/20 px-4 py-2 text-sm text-indigo-300 transition-all hover:bg-indigo-900/40"
              >
                <Recycle className="h-4 w-4" />
                AIナレッジ
              </button>
              <button
                onClick={() => fetchSuggestions()}
                disabled={generating}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-300 transition-all hover:bg-slate-700 disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                新しい提案
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openFeedback()}
                  className="flex items-center gap-2 rounded-xl bg-emerald-950/30 border border-emerald-500/20 px-4 py-2 text-sm text-emerald-300 transition-all hover:bg-emerald-900/40"
                >
                  <Plus className="h-4 w-4" />
                  自由入力フィードバック
                </button>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm text-slate-500">AI Connected</span>
              </div>
            </div>
          </div>
        </nav>

        <div className="mx-auto max-w-7xl px-6 py-12">
          {/* Header */}
          <header className="mb-14">
            <div className="inline-flex items-center gap-2 mb-4 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 text-sm text-indigo-300">
              <Sparkles className="h-4 w-4" />
              Gemini 2.5 Flash でパーソナライズ
            </div>
            <h2 className="text-4xl font-extrabold text-white mb-3 leading-tight">
              今日の提案をチェック
            </h2>
            <p className="text-slate-400 max-w-2xl leading-relaxed">
              あなたの嗜好・体調・過去のフィードバックから、Gemini AI が最適な3つのレシピを厳選しました。
              さらに要望を伝えて調整することも可能です。
            </p>

            {/* Refinement input */}
            <div className="mt-8 flex max-w-2xl gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={refinement}
                  onChange={(e) => setRefinement(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && refinement && fetchSuggestions(refinement)}
                  placeholder="例: 肉料理をメインにして、もっとピリ辛に"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/50 py-4 pl-5 pr-12 text-white outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                />
                <button
                  disabled={!refinement || generating}
                  onClick={() => fetchSuggestions(refinement)}
                  className="absolute right-2 top-2 h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-600 text-white transition-all hover:bg-indigo-500 disabled:opacity-20 disabled:grayscale"
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>

          {error && (
            <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-sm">
              ⚠️ {error}（フォールバックレシピを表示中）
            </div>
          )}

          {/* Recipe Cards */}
          <div className="grid gap-8 lg:grid-cols-3">
            {recipes.map((recipe, idx) => (
              <article
                key={recipe.id}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-900/40 backdrop-blur-sm transition-all duration-300 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between border-b border-slate-800/50 px-6 py-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-slate-400 group-hover:bg-gradient-to-br group-hover:from-indigo-500 group-hover:to-purple-600 group-hover:text-white transition-all duration-300">
                    0{idx + 1}
                  </span>
                  <a href={recipe.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">
                    {recipe.source}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {/* Card Body */}
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="mb-4 text-xl font-bold text-white group-hover:text-indigo-200 transition-colors leading-snug">
                    {recipe.title}
                  </h3>

                  {/* Tags */}
                  <div className="mb-5 flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 rounded-full bg-slate-800/60 px-3 py-1 text-xs font-medium text-slate-300 border border-slate-700/50">
                      <Clock className="h-3 w-3 text-sky-400" /> {recipe.cookingTime}分
                    </div>
                    {recipe.tags.map(tag => (
                      <span key={tag} className="rounded-full bg-indigo-900/20 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/20">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Content sections */}
                  <div className="mb-6 space-y-4 text-sm text-slate-400 leading-relaxed">
                    <div>
                      <h4 className="font-bold text-slate-200 mb-1 flex items-center gap-2">
                        <span className="text-base">🥬</span> 材料
                      </h4>
                      <p>{recipe.ingredients}</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 mb-1 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-400" /> 手順
                      </h4>
                      <p className="whitespace-pre-line line-clamp-4">{recipe.steps}</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 mb-1 flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-emerald-400" /> 栄養の狙い
                      </h4>
                      <p>{recipe.nutrition}</p>
                    </div>
                    {recipe.dishwashingTip && (
                      <div>
                        <h4 className="font-bold text-slate-200 mb-1 flex items-center gap-2">
                          <span className="text-base">🧽</span> 洗い物削減
                        </h4>
                        <p>{recipe.dishwashingTip}</p>
                      </div>
                    )}
                    {recipe.leftoverTip && (
                      <div>
                        <h4 className="font-bold text-slate-200 mb-1 flex items-center gap-2">
                          <Recycle className="h-4 w-4 text-teal-400" /> 余り食材の使い回し
                        </h4>
                        <p>{recipe.leftoverTip}</p>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="mt-auto flex gap-3">
                    <a
                      href={recipe.url}
                      target="_blank"
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition-all active:scale-95 hover:bg-indigo-50 hover:shadow-lg"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      レシピを見る
                    </a>
                    <button
                      onClick={() => openFeedback(recipe)}
                      className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-200 transition-all hover:bg-slate-700 active:scale-95"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      評価
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Feedback Modal */}
        {showFeedback && feedbackRecipe && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4" onClick={() => { setShowFeedback(null); setFeedbackRecipe(null); }}>
            <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-8 shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white">食後のフィードバック</h3>
                {feedbackRecipe.source === "Manual Input" ? (
                  <div className="mt-4 space-y-4">
                    <input
                      type="text"
                      placeholder="レシピ名 (例: 秘伝の肉じゃが)"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-indigo-500 transition-colors"
                      value={feedbackRecipe.title}
                      onChange={(e) => setFeedbackRecipe({ ...feedbackRecipe, title: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="参考URL (あれば)"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-indigo-500 transition-colors"
                      value={feedbackRecipe.url}
                      onChange={(e) => setFeedbackRecipe({ ...feedbackRecipe, url: e.target.value })}
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">「{feedbackRecipe.title}」の感想を教えてください</p>
                )}
              </div>

              <form onSubmit={handleFeedback} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">満足度 (1-5)</label>
                    <input name="rating" type="number" min="1" max="5" defaultValue="4"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-indigo-500 transition-colors" required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">手間 (1ツラい - 5ラク)</label>
                    <input name="easeOfCooking" type="number" min="1" max="5" defaultValue="4"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-indigo-500 transition-colors" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">体調 (-1/0/+1)</label>
                    <select name="physicalCondition" defaultValue="0"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-indigo-500 transition-colors">
                      <option value="-1">-1 体調悪い</option>
                      <option value="0">0 変わらず</option>
                      <option value="1">+1 体調良い</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">栄養感 (1-5)</label>
                    <input name="nutritionalValue" type="number" min="1" max="5" defaultValue="3"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-indigo-500 transition-colors" required />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">次回改善メモ</label>
                  <input name="improvementNote" type="text" placeholder="例: もっとピリ辛、鶏肉多め、副菜は酢の物系"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">余り食材（次回に使い回したい）</label>
                  <input name="leftoverFood" type="text" placeholder="例: 小松菜1/2束, ニンジン1本"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit"
                    className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 font-bold text-white transition-all hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98]">
                    送信してメモを更新
                  </button>
                  <button type="button"
                    onClick={() => { setShowFeedback(null); setFeedbackRecipe(null); }}
                    className="rounded-xl bg-slate-800 px-6 py-3 font-bold text-slate-400 hover:bg-slate-700 transition-colors">
                    閉じる
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Knowledge Modal */}
        {showKnowledge && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4" onClick={() => setShowKnowledge(false)}>
            <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/80 p-6 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-6 w-6 text-indigo-400" />
                      AIナレッジベース
                    </h3>
                    <p className="text-sm text-slate-400">AIが理解しているあなたのプロファイルと学習済みデータ</p>
                  </div>
                  <button onClick={() => setShowKnowledge(false)} className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-all">
                    <RefreshCw className="h-5 w-5 rotate-45" />
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-10">
                {knowledge ? (
                  <>
                    <section>
                      <h4 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                        <ChefHat className="h-5 w-5 text-indigo-400" />
                        基本プロファイル
                      </h4>
                      <div className="rounded-2xl bg-slate-950/50 border border-slate-800 p-5 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                        {knowledge.profile}
                      </div>
                    </section>

                    <section>
                      <h4 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                        <Recycle className="h-5 w-5 text-teal-400" />
                        学習された嗜好
                      </h4>
                      <div className="rounded-2xl bg-slate-950/50 border border-slate-800 p-5 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                        {knowledge.preferences}
                      </div>
                    </section>

                    <section>
                      <h4 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        最近のインサイト・傾向
                      </h4>
                      <div className="grid gap-3">
                        {knowledge.recentTrends.length > 0 ? knowledge.recentTrends.map((trend, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 p-4 text-sm text-slate-300 translate-x-0 transition-transform hover:translate-x-1 duration-300">
                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                            {trend}
                          </div>
                        )) : (
                          <p className="text-slate-500 text-sm italic">十分なフィードバックが蓄積されるとここに表示されます。</p>
                        )}
                      </div>
                    </section>

                    <section>
                      <h4 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                        <History className="h-5 w-5 text-purple-400" />
                        レシピ履歴 (Discovery Log)
                      </h4>
                      <div className="space-y-4">
                        {knowledge.discoveryLog.length > 0 ? knowledge.discoveryLog.map((log, i) => (
                          <div key={i} className="rounded-2xl bg-slate-950/50 border border-slate-800 p-5 transition-all hover:border-slate-700">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono text-slate-500">{log.date}</span>
                              <div className="flex gap-1 text-xs">
                                {Array.from({ length: 5 }).map((_, starIdx) => (
                                  <span key={starIdx} className={starIdx < log.rating ? "text-yellow-500" : "text-slate-700"}>★</span>
                                ))}
                              </div>
                            </div>
                            <a href={log.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-300 hover:text-indigo-200 flex items-center gap-1 mb-2">
                              {log.title}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            {log.note && (
                              <p className="text-xs text-slate-400 italic">「{log.note}」</p>
                            )}
                          </div>
                        )) : (
                          <p className="text-slate-500 text-sm italic">履歴はまだありません。</p>
                        )}
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* User Admin Modal */}
        {showUserAdmin && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4" onClick={() => setShowUserAdmin(false)}>
            <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl p-8" onClick={e => e.stopPropagation()}>
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Users className="h-6 w-6 text-indigo-400" />
                家族プロフィール管理
              </h3>

              <div className="space-y-4 mb-8">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between rounded-xl bg-slate-800/50 p-4 border border-slate-700">
                    <span className="font-bold text-slate-200">{u.name}</span>
                    {u.id !== 'default' && (
                      <span className="text-xs text-slate-500">ID: {u.id}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase text-slate-500">新しいメンバーを追加</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="名前 (例: おじいちゃん)"
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    onClick={addUser}
                    disabled={!newUserName.trim()}
                    className="rounded-xl bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-500 disabled:opacity-50 transition-all font-bold"
                  >
                    追加
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowUserAdmin(false)}
                className="mt-8 w-full rounded-xl bg-slate-800 py-3 font-bold text-slate-400 hover:bg-slate-700 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </main>
    </AuthGuard>
  );
}
