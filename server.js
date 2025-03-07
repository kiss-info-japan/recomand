require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
if (!MISTRAL_API_KEY) {
    console.error("🚨 MISTRAL_API_KEY が設定されていません！.env ファイルを確認してください。");
    process.exit(1);
}

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

// 📌 ユーザーごとの診断データを保存
const userSessions = {};

// 📌 診断テスト開始API
app.post('/start-diagnosis', async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: "userId が必要です。" });
    }

    try {
        // AIに診断用の質問を生成させる
        const questionPrompt = `
          宗教観を診断するための質問を15個考えてください。
            - 自由回答しやすい形にする
            - 不自然な言い回しにならないようにする
            - 信仰、価値観、運命、神、死後の世界、魂などに関する知識がないユーザーが、自らの価値観を改めて考えながら判断できるような質問にする
            - 15個の質問のうち、内容が重複しないようにする。
            - 子供でも理解できるような簡単な言い回しにする
        `;

        const response = await fetch(MISTRAL_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MISTRAL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'mistral-medium',
                messages: [{ role: 'user', content: questionPrompt }]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error("🚨 Mistral API エラー:", data);
            throw new Error(data.error || 'Mistral API error');
        }

        // 質問リストを取得
        const questions = data.choices[0].message.content
            .split('\n')
            .map(q => q.replace(/^\d+\.\s*/, '').trim())
            .filter(q => q.length > 0);

        if (questions.length < 15) {
            return res.status(500).json({ error: "質問の生成に失敗しました。" });
        }

        // ユーザーのセッションを作成
        userSessions[userId] = { questions, answers: [] };

        // 最初の質問を送信
        res.json({ reply: `🌟 宗教診断テストへようこそ！\n\n最初の質問です👇\n${questions[0]}` });

    } catch (error) {
        console.error("🚨 サーバーエラー:", error);
        res.status(500).json({ error: error.message });
    }
});

// 📌 診断テストの進行API
app.post('/chat', async (req, res) => {
    try {
        const { userId, message } = req.body;
        if (!userId || !message) {
            return res.status(400).json({ error: "userIdとmessageが必要です。" });
        }

        // 診断セッションがない場合
        if (!userSessions[userId]) {
            return res.status(400).json({ error: "診断がまだ開始されていません。" });
        }

        const session = userSessions[userId];
        session.answers.push(message);

        // 次の質問を送る
        const nextQuestionIndex = session.answers.length;
        if (nextQuestionIndex < session.questions.length) {
            res.json({
                reply: `${nextQuestionIndex + 1}番目の質問:\n${session.questions[nextQuestionIndex]}`
            });
        } else {
            // 📌 診断ロジック（Mistral AI に依頼）
            const diagnosisPrompt = ` 
            以下の質問と回答に基づいて、ユーザーに最も適した宗教を1つ選び、フランクで分かりやすい言葉で説明してください。
        
            【診断ルール】
            - 以下のリストから選んでください。
                "イスラム教"
                "ヒンドゥー教""
                "仏教"
                "シク教"
                "ユダヤ教"
                "道教"
                "バハーイ教"
                "神道"
                "ゾロアスター教"
                "シャーマニズム"
                "サタニズム"
                "クリスチャン・サイエンス"
                "ムスリム・シーア派"
                "ムスリム・スンニ派"
                "モルモン教"
                "アフリカ伝統宗教"
                "カバラ"
                "ヴィシュヌ教"
                "ジャイナ教"
                "ローマカトリック
                "プロテスタント"
                "アングリカン教"
                "ニコラウス主義"
                "メソポタミア宗教"
                "エジプト神殿信仰"
                "アステカ宗教"
                "インカ宗教"
                "ノルディック宗教"
                "シュメール宗教"
                "アニミズム"
                "ヘブライ宗教教"
                "アニミズム"
                "タオイ"
                "ナバホ教"
                "ケルト宗教"
                "バーニズム"
                "ザラスシュトラ教"
                "インディアン宗教"
                "チベット仏教"
                "スピリチュアリズム"
                "サンテリア"
                "ヴードゥー"
                "オリシャ信仰"
                "ウィッカ"
        
            質問と回答:
            ${session.questions.map((q, i) => `Q: ${q}\nA: ${session.answers[i]}`).join('\n')}
        
            【診断結果】
            - 結果は**「あなたの宗教診断結果は ○○ です！」**の形式で提示してください。
            - なぜその宗教が合っているのかを、カジュアルでわかりやすい言葉で説明してください（例：「この宗教は〇〇を大事にしていて、あなたの考えとピッタリ！」）。
            - その宗教がどこで信仰されているのか、どんな神を信じるのかの簡単な説明を加えてください。
            - ユーザーの回答を基に、**価値観・思想の傾向**を簡潔に分析し、「あなたの考え方の特徴」として要約してください。
            
            例：
            🌟 診断が完了しました！  
            🎉 あなたの宗教診断結果は「○○」です！ 🎉  
            🧐○○って？  
            これは「○○」という考え方で、神様に頼るのではなく、自分たちの力でより良い世界を作ろうとする思想なんだ。
        
            📝 あなたの考え方の特徴：
            - 「神様よりも、人間の意思を大切にしたい」
            - 「自分の選択を自由にしたい！」
            - 「みんなが幸せになる方法を考えたい」など
        
            📖 ミニ解説コラム：  
            ○○は、古代ギリシャの哲学者エピクロスの思想（快楽主義）や、近代の人文主義（ヒューマニズム）から発展した考え方だよ。ヨーロッパやアメリカではけっこう人気があって、科学や人権を大切にする人たちの間で支持されてるんだ。
        
            💡 まとめ：  
            あなたは「自由と人間らしさ」を大切にするタイプ！「愛にあふれた世界」を望んでいて、自分の頭で考えて行動するのが好きなんじゃないかな？○○は、そんなあなたの価値観にピッタリかも✨
        `;
        

            const diagnosisResponse = await fetch(MISTRAL_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${MISTRAL_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'mistral-medium',
                    messages: [{ role: 'user', content: diagnosisPrompt }]
                })
            });

            const diagnosisData = await diagnosisResponse.json();
            if (!diagnosisResponse.ok) {
                console.error("🚨 診断APIエラー:", diagnosisData);
                throw new Error(diagnosisData.error || 'Mistral API error');
            }

            // 📌 診断結果を取得
            const diagnosisResult = diagnosisData.choices[0].message.content.trim();

            // 診断結果をユーザーに送信
            res.json({
                reply: `診断が完了しました！\n\n${diagnosisResult}`
            });

            // 診断結果を保存（任意）
            session.diagnosis = diagnosisResult;
        }
    } catch (error) {
        console.error("🚨 エラー:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 サーバーがポート ${PORT} で起動しました`);
});