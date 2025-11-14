import { GoogleGenAI, Type } from "@google/genai";
import { CEFRLevel, FavoriteWord } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function generateText(level: CEFRLevel, theme: string, wordCount: number, mood: string): Promise<string> {
    const prompt = `Du bist ein Deutschlehrer. Erstelle einen zusammenhängenden und interessanten Text oder eine Geschichte mit etwa ${wordCount} Wörtern für einen Deutschlerner auf dem ${level}-Niveau zum Thema "${theme}". Der Ton des Textes sollte ${mood} sein. Der Text sollte klar, gut strukturiert und für das angegebene Sprachniveau angemessen sein. Antworte nur mit dem generierten Text.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating text:", error);
        throw new Error("Metin oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.");
    }
}

export async function generateRandomTheme(level: CEFRLevel, mood: string): Promise<string> {
    const prompt = `Gib mir ein interessantes und kreatives Thema für eine ${mood} Geschichte für einen Deutschlerner auf dem ${level}-Niveau. Antworte nur mit dem Thema selbst, ohne zusätzliche Sätze, Erklärungen oder Anführungszeichen.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        // Trim whitespace and remove quotes if the model adds them by mistake
        return response.text.trim().replace(/^"|"$/g, '');
    } catch (error) {
        console.error("Error generating random theme:", error);
        throw new Error("Rastgele tema oluşturulurken bir hata oluştu.");
    }
}

export async function translateText(text: string): Promise<string> {
    const prompt = `Übersetze den folgenden deutschen Text ins Türkische: "${text}"`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error translating text:", error);
        throw new Error("Çeviri sırasında bir hata oluştu.");
    }
}

export async function translateWord(word: string): Promise<string> {
    const prompt = `Translate the following German word/phrase into Turkish. Provide only the most common translation. Do not add any extra text or explanations. Word: "${word}"`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error translating word:", error);
        throw new Error("Kelime çevirisi sırasında bir hata oluştu.");
    }
}

export async function translateTextSentenceBySentence(text: string) {
    const prompt = `Übersetze den folgenden deutschen Text Satz für Satz ins Türkische. Gib die Antwort als JSON-Array zurück, wobei jedes Objekt die Schlüssel "german" und "turkish" hat. Der Text: "${text}"`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            german: { type: Type.STRING },
                            turkish: { type: Type.STRING },
                        },
                    },
                },
            },
        });
        const parsed = JSON.parse(response.text);
        return parsed;

    } catch (error) {
        console.error("Error in sentence-by-sentence translation:", error);
        throw new Error("Cümle çevirisi sırasında bir hata oluştu.");
    }
}


export async function generateQuiz(text: string, questionCount: number) {
    const sanitizedText = text.replace(/"/g, '\\"');
    const prompt = `Erstelle ein Multiple-Choice-Quiz mit ${questionCount} Fragen auf Deutsch basierend auf dem folgenden deutschen Text. Das Quiz sollte das Textverständnis und den Wortschatz testen. Gib die Antwort als JSON-Array zurück. Jedes Objekt sollte die Schlüssel "question" (die Frage auf Deutsch), "options" (ein Array von 4 deutschen Strings als Antwortmöglichkeiten) und "correctAnswer" (die richtige deutsche Antwort aus den Optionen) haben. Der Text: "${sanitizedText}"`;
    
    let responseText = '';
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { 
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            },
                            correctAnswer: { type: Type.STRING },
                        },
                         required: ["question", "options", "correctAnswer"]
                    },
                },
            },
        });
        
        responseText = response.text;
        const parsed = JSON.parse(responseText);
        return parsed;

    } catch (error) {
        console.error("Error generating quiz:", error);
        if (error instanceof SyntaxError) {
            console.error("Failed to parse JSON for quiz. Raw response text:", responseText);
            throw new Error("Test oluşturulamadı çünkü modelden geçersiz bir yanıt alındı. Lütfen farklı bir metinle tekrar deneyin.");
        }
        throw new Error("Test oluşturulurken bir hata oluştu.");
    }
}

export async function explainAndExampleWord(word: string, level: CEFRLevel) {
    const prompt = `Erkläre das deutsche Wort/die deutsche Phrase "${word}" für einen Deutschlerner auf dem ${level}-Niveau auf einfachem Deutsch. Gib auch 2 Beispielsätze. Gib die Antwort als JSON-Objekt mit den Schlüsseln "explanation" (eine Zeichenkette) und "examples" (ein Array von Zeichenketten).`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: { type: Type.STRING },
                        examples: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                    },
                    required: ["explanation", "examples"]
                },
            },
        });
        const parsed = JSON.parse(response.text);
        return parsed;
    } catch (error) {
        console.error("Error explaining word:", error);
        throw new Error("Kelime açıklanırken bir hata oluştu.");
    }
}

export async function generateClozeTest(words: FavoriteWord[], level: CEFRLevel) {
    const wordList = words.map(w => `"${w.german}"`).join(', ');
    const prompt = `Erstelle einen kurzen, zusammenhängenden deutschen Text von etwa 5-7 Sätzen auf dem ${level}-Niveau, der die folgenden Wörter/Phrasen natürlich verwendet: ${wordList}. Gib die Antwort als JSON-Objekt mit zwei Schlüsseln zurück: 'clozeText' (der Text, in dem jedes Zielwort durch '[___]' ersetzt wurde) und 'answers' (ein Array der ursprünglichen Wörter in der Reihenfolge, in der sie im Text erscheinen). Stelle sicher, dass die Reihenfolge der Wörter im 'answers'-Array genau der Reihenfolge der Lücken im 'clozeText' entspricht.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        clozeText: { type: Type.STRING },
                        answers: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                    },
                    required: ["clozeText", "answers"]
                },
            },
        });
        const parsed = JSON.parse(response.text);
        return parsed;
    } catch (error) {
        console.error("Error generating cloze test:", error);
        throw new Error("Öğrenme modu içeriği oluşturulurken bir hata oluştu.");
    }
}

export async function generateDistractors(word: string, context: string) {
    const prompt = `Der folgende deutsche Satz hat eine Lücke: "${context}". Das richtige Wort für die Lücke ist "${word}". Erstelle 3 plausible, aber falsche deutsche Antwortmöglichkeiten (Distraktoren) für diese Lücke. Die Distraktoren sollten grammatikalisch in den Satz passen, aber die Bedeutung falsch machen. Gib die Antwort als JSON-Array zurück, das nur die 3 falschen Wörter enthält.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
            },
        });
        const parsed = JSON.parse(response.text);
        return parsed;

    } catch (error) {
        console.error("Error generating distractors:", error);
        throw new Error("Alternatif şıklar oluşturulurken bir hata oluştu.");
    }
}

export async function generateClozeTestFromText(text: string, level: CEFRLevel) {
    const prompt = `Basierend auf dem folgenden deutschen Text auf dem ${level}-Niveau, erstelle einen Lückentext (cloze test). Wähle 5-10 wichtige und für das Niveau relevante Wörter (Substantive, Verben, Adjektive) aus, die im Text ausgefüllt werden sollen. Gib die Antwort als JSON-Objekt mit zwei Schlüsseln zurück: 'clozeText' (der Text, in dem jedes Zielwort durch '[___]' ersetzt wurde) und 'answers' (ein Array der ursprünglichen Wörter in der Reihenfolge, in der sie im Text erscheinen). Stelle sicher, dass die Reihenfolge der Wörter im 'answers'-Array genau der Reihenfolge der Lücken im 'clozeText' entspricht. Der Text: "${text}"`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        clozeText: { type: Type.STRING },
                        answers: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                    },
                    required: ["clozeText", "answers"]
                },
            },
        });
        const parsed = JSON.parse(response.text);
        return parsed;
    } catch (error) {
        console.error("Error generating cloze test from text:", error);
        throw new Error("Metinden öğrenme modu içeriği oluşturulurken bir hata oluştu.");
    }
}