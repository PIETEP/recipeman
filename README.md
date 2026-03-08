# Recipe Loop - AI-Powered 献立提案ループ

ユーザーの食後フィードバックを元に、Gemini AI が翌日以降のレシピ提案をパーソナライズする「献立提案ループ」アプリです。

## 起動手順

### 1. 依存関係のインストール
```bash
cd recipe
npm install
```

### 2. Gemini API キー設定

`.env.local` ファイルを編集し、Gemini API キーを設定してください:

```
GEMINI_API_KEY=your_actual_api_key_here
```

> Gemini API キーは [Google AI Studio](https://aistudio.google.com/apikey) で無料で取得できます。

### 3. 開発サーバー起動
```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開いてください。

---

## 設計

| レイヤー | 技術 |
|---|---|
| フロント | Next.js 16 (App Router) + Tailwind CSS v4 + Lucide React |
| バック | Next.js Route Handlers |
| AI | Google Gemini 2.0 Flash (`@google/generative-ai`) |
| DB | `local_db.json`（JSONファイルベース） |
| メモリ | `memory/users/default/` 以下のMarkdownファイル |

## データ構造

```
memory/
  users/
    default/
      profile.md        # 固定条件（アレルギー/NG食材/健康重視ポイント）
      preferences.md    # 学習された嗜好（味の傾向/改善メモ蓄積）
      log/
        YYYY-MM.md      # 月次の食事ログと評価
local_db.json           # レシピキャッシュ / フィードバック / 提案ログ
```

## スコアリング・提案ロジック

1. **Gemini プロンプト**: `profile.md` + `preferences.md` + 直近14件のフィードバック要約をプロンプトに含め、AIが実在するレシピサイトから3つを提案
2. **必須フィルタ**: 調理時間20分以内、野菜2種以上、タンパク質必須、味の系統ローテーション
3. **フィードバック反映例**:
   - 手間が低評価 → 次回は時短/ワンパン/レンジ系を優先
   - 体調が-1 → 脂っこいものを避け、蒸し/煮物系に寄せる
   - 改善メモ → そのままプロンプトに反映
4. **フォールバック**: API失敗時は内蔵のデフォルトレシピを表示

## 今後のTODO

- [ ] Web検索APIでリアルタイムのURLバリデーション
- [ ] 複数ユーザー対応と簡易認証
- [ ] 定期配信（毎朝7時に提案を自動生成）
- [ ] 食材在庫入力 → 在庫優先で候補を出す
- [ ] 週次レポート生成
