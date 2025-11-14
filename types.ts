export type CEFRLevel = "A2" | "B1" | "B2" | "C1";

export interface FavoriteWord {
    german: string;
    turkish: string;
}

export interface FavoriteList {
    id: string;
    name: string;
    words: FavoriteWord[];
}

export interface WordExplanation {
    explanation: string;
    examples: string[];
}

export interface TranslationPair {
    german: string;
    turkish: string;
}

export interface QuizQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
}

export interface TooltipData {
    x: number;
    y: number;
    text: string;
    translation: string;
}
