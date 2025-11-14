import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CEFRLevel, TranslationPair, QuizQuestion, TooltipData, FavoriteWord, FavoriteList, WordExplanation } from './types';
import { LEVELS, MOODS } from './constants';
import * as geminiService from './services/geminiService';
import { ArrowDownTrayIcon, ArrowPathIcon, BookOpenIcon, SparklesIcon, PlayIcon, PauseIcon, TrashIcon, BookmarkIcon, PlusCircleIcon, HeartIcon, HomeIcon, WandSparklesIcon, AcademicCapIcon } from './components/icons';

interface SavedText {
    title: string;
    text: string;
    level: CEFRLevel;
    translations: TranslationPair[];
    quiz: QuizQuestion[];
}

type View = 'main' | 'favorites';

const getPreview = (text: string) => text.split(' ').slice(0, 10).join(' ') + '...';

const App: React.FC = () => {
    const [view, setView] = useState<View>('main');
    
    // Core State
    const [level, setLevel] = useState<CEFRLevel>('A2');
    const [theme, setTheme] = useState<string>('');
    const [wordCount, setWordCount] = useState<number>(150);
    const [mood, setMood] = useState<string>(MOODS[0]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Content State
    const [generatedText, setGeneratedText] = useState<string>('');
    const [translatedSentences, setTranslatedSentences] = useState<TranslationPair[]>([]);
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    
    // Favorites State
    const [favoriteLists, setFavoriteLists] = useState<FavoriteList[]>([]);
    const [savedTexts, setSavedTexts] = useState<SavedText[]>([]);
    const [addToListModal, setAddToListModal] = useState<{ german: string; turkish: string; x: number; y: number } | null>(null);

    // UI State
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const [wordTooltip, setWordTooltip] = useState<{ x: number; y: number; german: string } | null>(null);
    const [isTranslatingWord, setIsTranslatingWord] = useState(false);
    const [wordTranslation, setWordTranslation] = useState('');
    const wordTooltipRef = useRef<HTMLDivElement>(null);
    const addToListModalRef = useRef<HTMLDivElement>(null);
    
    // Quiz State
    const [currentQuizQuestion, setCurrentQuizQuestion] = useState(0);
    const [quizAnswers, setQuizAnswers] = useState<{[key: number]: string}>({});
    const [quizScore, setQuizScore] = useState<number | null>(null);

    // TTS State
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speakingSentenceIndex, setSpeakingSentenceIndex] = useState<number | null>(null);
    const [germanVoice, setGermanVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [isTtsSupported, setIsTtsSupported] = useState(false);

    // Learning Mode State
    const [learningModeList, setLearningModeList] = useState<FavoriteList | null>(null);

    // Text Cloze Test State
    const [isTextClozeMode, setIsTextClozeMode] = useState(false);
    const [textClozeData, setTextClozeData] = useState<{ clozeText: string; answers: string[] } | null>(null);
    const [isGeneratingCloze, setIsGeneratingCloze] = useState(false);

    useEffect(() => {
        try {
            const storedLists = localStorage.getItem('favoriteLists');
            if (storedLists) setFavoriteLists(JSON.parse(storedLists));
            
            const storedTexts = localStorage.getItem('savedTexts');
            if (storedTexts) setSavedTexts(JSON.parse(storedTexts));
        } catch (e) {
            console.error("Failed to parse from localStorage", e);
        }
    }, []);
    
    useEffect(() => {
        try {
            localStorage.setItem('favoriteLists', JSON.stringify(favoriteLists));
        } catch (e) { console.error("Failed to save favorite lists", e); }
    }, [favoriteLists]);

     useEffect(() => {
        try {
            localStorage.setItem('savedTexts', JSON.stringify(savedTexts));
        } catch (e) { console.error("Failed to save texts", e); }
    }, [savedTexts]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wordTooltip && wordTooltipRef.current && !wordTooltipRef.current.contains(event.target as Node)) setWordTooltip(null);
            if (addToListModal && addToListModalRef.current && !addToListModalRef.current.contains(event.target as Node)) setAddToListModal(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [wordTooltip, addToListModal]);

    useEffect(() => {
        if (!('speechSynthesis' in window) || window.speechSynthesis === null) {
            setIsTtsSupported(false);
            return;
        }
        setIsTtsSupported(true);
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            const voice = voices.find(v => v.lang === 'de-DE' && v.name.includes('Google')) || voices.find(v => v.lang === 'de-DE');
            if (voice) setGermanVoice(voice);
        };
        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
        return () => {
            if (window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = null;
                if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
            }
        };
    }, []);

    const handleGenerate = async (levelToUse: CEFRLevel, themeToUse: string, moodToUse: string) => {
        setIsLoading(true);
        setError(null);
        setGeneratedText('');
        setTranslatedSentences([]);
        setQuizQuestions([]);
        setQuizScore(null);
        setCurrentQuizQuestion(0);
        setQuizAnswers({});
        setIsTextClozeMode(false);
        setTextClozeData(null);
        setLevel(levelToUse);
        setTheme(themeToUse);
        setMood(moodToUse);
        
        try {
            const text = await geminiService.generateText(levelToUse, themeToUse, wordCount, moodToUse);
            setGeneratedText(text);
            const sentences = await geminiService.translateTextSentenceBySentence(text);
            if (sentences) setTranslatedSentences(sentences);
            const quiz = await geminiService.generateQuiz(text, 5);
            if (quiz) setQuizQuestions(quiz);
        } catch (e) {
            console.error(e);
            setError("İçerik oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGenerateRandom = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const randomTheme = await geminiService.generateRandomTheme(level, mood);
            await handleGenerate(level, randomTheme, mood);
        } catch (e) {
            console.error(e);
            setError("Rastgele tema oluşturulurken bir hata oluştu.");
            setIsLoading(false);
        }
    };

    const handleStartNewStory = () => {
        if (isTtsSupported && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setSpeakingSentenceIndex(null);
        setGeneratedText('');
        setTranslatedSentences([]);
        setQuizQuestions([]);
        setError(null);
        setQuizScore(null);
        setCurrentQuizQuestion(0);
        setQuizAnswers({});
        setIsTextClozeMode(false);
        setTextClozeData(null);
        setLevel('A2');
        setTheme('');
        setWordCount(150);
        setMood(MOODS[0]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleWordHover = (e: React.MouseEvent<HTMLSpanElement>, germanSentence: string) => {
        const translation = translatedSentences.find(s => s.german === germanSentence)?.turkish || '...';
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY - rect.height,
            text: germanSentence,
            translation,
        });
    };

    const handleWordLeave = () => setTooltip(null);
    
    const handleTextSelection = () => {
        setTimeout(async () => {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const selectedText = selection.toString().trim();
                if (selectedText.length > 0 && selectedText.length < 50 && selectedText.split(' ').length <= 5) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    setWordTooltip({
                        x: rect.left + window.scrollX,
                        y: rect.top + window.scrollY - 10,
                        german: selectedText,
                    });
                    setIsTranslatingWord(true);
                    setWordTranslation('');
                    try {
                        const translation = await geminiService.translateWord(selectedText);
                        setWordTranslation(translation);
                    } catch (err) {
                        console.error(err);
                        setWordTranslation('Çeviri hatası');
                    } finally {
                        setIsTranslatingWord(false);
                    }
                } else {
                    if (wordTooltip) setWordTooltip(null);
                }
            } else {
                 if (wordTooltip) setWordTooltip(null);
            }
        }, 10);
    };

    const handleOpenAddToList = (german: string, turkish: string, x: number, y: number) => {
        if (!turkish || turkish === 'Çeviri hatası') return;
        setAddToListModal({ german, turkish, x, y });
        setWordTooltip(null);
    };

    const handleCreateList = (listName: string): FavoriteList | undefined => {
        if (!listName.trim()) return;
        const newList: FavoriteList = {
            id: crypto.randomUUID(),
            name: listName.trim(),
            words: [],
        };
        setFavoriteLists(prev => [newList, ...prev]);
        return newList;
    };

    const handleDeleteList = (listId: string) => {
        setFavoriteLists(prev => prev.filter(list => list.id !== listId));
    };
    
    const handleAddWordToList = (word: FavoriteWord, listId: string) => {
        setFavoriteLists(prev => prev.map(list => {
            if (list.id === listId) {
                // Prevent duplicates
                if (list.words.some(w => w.german.toLowerCase() === word.german.toLowerCase())) {
                    return list;
                }
                return { ...list, words: [...list.words, word] };
            }
            return list;
        }));
        setAddToListModal(null);
    };

    const handleRemoveWordFromList = (germanWord: string, listId: string) => {
        setFavoriteLists(prev => prev.map(list => {
            if (list.id === listId) {
                return { ...list, words: list.words.filter(w => w.german.toLowerCase() !== germanWord.toLowerCase())};
            }
            return list;
        }))
    };

    const isWordInFavorites = (germanWord: string): boolean => {
        const lowerGerman = germanWord.toLowerCase();
        return favoriteLists.some(list => list.words.some(w => w.german.toLowerCase() === lowerGerman));
    };

    const isTextSaved = savedTexts.some(t => t.text === generatedText);

    const handleSaveText = () => {
        if (!generatedText || isTextSaved) return;
        const newSavedText: SavedText = {
            title: theme,
            text: generatedText,
            level: level,
            translations: translatedSentences,
            quiz: quizQuestions,
        };
        setSavedTexts(prev => [newSavedText, ...prev]);
    };
    
    const handleLoadText = (textToLoad: SavedText) => {
        setTheme(textToLoad.title);
        setLevel(textToLoad.level);
        setGeneratedText(textToLoad.text);
        setTranslatedSentences(textToLoad.translations);
        setQuizQuestions(textToLoad.quiz);
        setQuizScore(null);
        setCurrentQuizQuestion(0);
        setQuizAnswers({});
        setIsTextClozeMode(false);
        setTextClozeData(null);
        setView('main');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteText = (textToDelete: SavedText) => {
        setSavedTexts(prev => prev.filter(t => t.text !== textToDelete.text));
    };

    const handleExportTexts = () => {
        if (savedTexts.length === 0) return;
        const fileContent = savedTexts.map(t => 
            `--- ${t.title} (${t.level}) ---\n\n${t.text}\n\n`
        ).join('\n');
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'deutsch-meister-favoriler.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleAnswer = (questionIndex: number, answer: string) => setQuizAnswers({ ...quizAnswers, [questionIndex]: answer });

    const submitQuiz = () => {
        let score = 0;
        quizQuestions.forEach((q, index) => {
            if (quizAnswers[index] === q.correctAnswer) score++;
        });
        setQuizScore(score);
    };
    
    const resetQuiz = () => {
        setQuizScore(null);
        setCurrentQuizQuestion(0);
        setQuizAnswers({});
    };

    const handlePlayPause = () => {
        if (!isTtsSupported) {
            setError("Seslendirme özelliği bu tarayıcıda desteklenmiyor.");
            return;
        }
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            setSpeakingSentenceIndex(null);
        } else if (translatedSentences.length > 0) {
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
            setIsSpeaking(true);
            playSentences(0);
        }
    };

    const playSentences = (index: number) => {
        if (index >= translatedSentences.length) {
            setIsSpeaking(false);
            setSpeakingSentenceIndex(null);
            return;
        }
        setSpeakingSentenceIndex(index);
        const sentence = translatedSentences[index].german;
        if (!sentence?.trim()) {
            playSentences(index + 1);
            return;
        }
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = 'de-DE';
        if (germanVoice) utterance.voice = germanVoice;
        utterance.onend = () => playSentences(index + 1);
        utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
            if (event.error === 'canceled' || event.error === 'interrupted') return;
            console.error('SpeechSynthesisUtterance.onerror', event.error, event);
            setError('Seslendirme sırasında bir hata oluştu.');
            setIsSpeaking(false);
            setSpeakingSentenceIndex(null);
        };
        window.speechSynthesis.speak(utterance);
    };
    
    const handleStartTextClozeMode = async () => {
        if (!generatedText) return;
        setIsGeneratingCloze(true);
        setError(null);
        try {
            const data = await geminiService.generateClozeTestFromText(generatedText, level);
            if (data && data.answers && data.answers.length > 0) {
                setTextClozeData(data);
                setIsTextClozeMode(true);
            } else {
                setError("Bu metin için öğrenme modu oluşturulamadı. Lütfen farklı bir metin deneyin.");
            }
        } catch (e) {
            console.error(e);
            setError("Öğrenme modu oluşturulurken bir hata oluştu.");
        } finally {
            setIsGeneratingCloze(false);
        }
    };

    const renderMainContent = () => {
        if (isTextClozeMode && textClozeData) {
            return <TextClozeTestView 
                clozeData={textClozeData} 
                onFinish={() => {
                    setIsTextClozeMode(false);
                    setTextClozeData(null);
                }}
            />;
        }
        if (isLoading) return <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-zinc-800 rounded-lg"><ArrowPathIcon className="w-12 h-12 animate-spin text-yellow-400" /><p className="mt-4 text-lg">Harika bir içerik hazırlanıyor...</p></div>;
        if (error) return <div className="p-8 text-center bg-red-900/50 text-red-300 rounded-lg">{error}</div>;
        if (!generatedText) return <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-zinc-800 rounded-lg"><BookOpenIcon className="w-16 h-16 text-zinc-500" /><h2 className="mt-4 text-2xl font-bold">Deutsch-Meister'a Hoş Geldiniz!</h2><p className="mt-2 text-zinc-400">Öğrenmeye başlamak için soldaki panelden seviyenizi ve bir tema seçerek metin oluşturun.</p></div>;
        
        return (
            <div className="space-y-8">
                <div className="p-6 bg-zinc-800 rounded-lg shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-yellow-400">{theme}</h2>
                        <div className="flex items-center gap-2">
                             <button onClick={handleStartTextClozeMode} disabled={isGeneratingCloze} title="Öğrenme Modu" className="p-2 rounded-full text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700 transition disabled:cursor-wait disabled:text-zinc-600">
                                 {isGeneratingCloze ? <ArrowPathIcon className="w-6 h-6 animate-spin" /> : <AcademicCapIcon className="w-6 h-6" />}
                             </button>
                             <button onClick={handleSaveText} disabled={isTextSaved} title={isTextSaved ? "Metin zaten kayıtlı" : "Bu metni kaydet"} className="p-2 rounded-full disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700 transition">
                                <BookmarkIcon className={`w-6 h-6 ${isTextSaved ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                            </button>
                            {isTtsSupported && (
                                <button onClick={handlePlayPause} title={isSpeaking ? "Durdur" : "Seslendir"} className="p-2 rounded-full text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700 transition">
                                    {isSpeaking ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                                </button>
                            )}
                        </div>
                    </div>
                     <p onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection} className="text-zinc-300 leading-loose text-lg selection:bg-yellow-400 selection:text-zinc-900">
                        {translatedSentences.map((sentence, index) => (
                            <span key={index} 
                                className={`cursor-pointer transition duration-150 p-1 rounded ${speakingSentenceIndex === index ? 'bg-yellow-800/50' : 'hover:bg-zinc-700/50'}`}
                                onMouseEnter={(e) => handleWordHover(e, sentence.german)}
                                onMouseLeave={handleWordLeave}
                            >
                                {sentence.german}{' '}
                            </span>
                        ))}
                    </p>
                </div>
                <div className="p-6 bg-zinc-800 rounded-lg shadow-lg">
                     <h3 className="text-xl font-bold mb-4 text-yellow-400">Cümle Çevirileri</h3>
                     <ul className="space-y-4">
                        {translatedSentences.map((s, i) => (
                             <li key={i} className="border-b border-zinc-700 pb-2">
                                <p className="text-zinc-300">{s.german}</p>
                                <p className="text-yellow-500">{s.turkish}</p>
                            </li>
                        ))}
                     </ul>
                </div>
                <QuizView questions={quizQuestions} score={quizScore} currentQuestionIndex={currentQuizQuestion} answers={quizAnswers} onAnswer={handleAnswer} onSubmit={submitQuiz} onReset={resetQuiz} onNavigate={setCurrentQuizQuestion} />
            </div>
        );
    };

    const Header = () => (
        <header className="bg-zinc-800/50 backdrop-blur-sm sticky top-0 z-40 mb-8">
            <div className="container mx-auto flex justify-between items-center p-4">
                <h1 className="text-2xl font-bold text-yellow-400">Deutsch-Meister</h1>
                <nav>
                    <button onClick={() => { setView('main'); setLearningModeList(null); }} title="Ana Sayfa" className={`p-2 rounded-lg transition ${view === 'main' ? 'bg-yellow-400 text-zinc-900' : 'hover:bg-zinc-700'}`}>
                        <HomeIcon className="w-6 h-6"/>
                    </button>
                    <button onClick={() => setView('favorites')} title="Favorilerim" className={`p-2 rounded-lg transition ml-2 ${view === 'favorites' ? 'bg-yellow-400 text-zinc-900' : 'hover:bg-zinc-700'}`}>
                        <HeartIcon className="w-6 h-6" filled={view === 'favorites'}/>
                    </button>
                </nav>
            </div>
        </header>
    );

    return (
        <div className="bg-zinc-900 min-h-screen font-sans text-zinc-100">
            {tooltip && <div className="fixed bg-zinc-900 border border-yellow-400 text-white p-3 rounded-lg shadow-lg z-50 transform -translate-y-full" style={{ left: tooltip.x, top: tooltip.y }}><p className="font-bold text-yellow-400">{tooltip.translation}</p></div>}
            {wordTooltip && <div ref={wordTooltipRef} className="fixed bg-zinc-800 border border-yellow-400 text-white p-3 rounded-lg shadow-2xl z-50 transform -translate-y-full flex items-center gap-4" style={{ left: wordTooltip.x, top: wordTooltip.y, maxWidth: '300px' }}>
                <div>
                    <p className="font-bold">{wordTooltip.german}</p>
                    {isTranslatingWord ? <p className="text-sm text-zinc-400">Çevriliyor...</p> : <p className="text-sm text-yellow-400 capitalize">{wordTranslation}</p>}
                </div>
                {!isTranslatingWord && (
                    <button onClick={() => handleOpenAddToList(wordTooltip.german, wordTranslation, wordTooltip.x, wordTooltip.y)} className="p-2 rounded-full hover:bg-zinc-700 transition">
                        <HeartIcon className="w-6 h-6 text-zinc-400 hover:text-red-400" filled={isWordInFavorites(wordTooltip.german)} />
                    </button>
                )}
            </div>}
            {addToListModal && <AddToListModal modalData={addToListModal} lists={favoriteLists} onCreateList={handleCreateList} onAddWord={handleAddWordToList} modalRef={addToListModalRef} />}
            
            <Header />

            <main className="container mx-auto p-4 md:px-8">
                {view === 'main' && (
                     <div className="flex flex-col lg:flex-row gap-8">
                        <aside className="w-full lg:w-1/3 xl:w-1/4 flex flex-col gap-8">
                           <div className="bg-zinc-800 p-6 rounded-lg shadow-lg h-fit sticky top-28">
                                <h2 className="text-xl font-bold mb-4 text-yellow-400 flex items-center gap-2"><SparklesIcon className="w-6 h-6"/> Metin Oluşturucu</h2>
                                <div className="space-y-4">
                                    <div><label htmlFor="level" className="block text-sm font-medium text-zinc-400">Seviye</label><select id="level" value={level} onChange={e => setLevel(e.target.value as CEFRLevel)} className="mt-1 block w-full bg-zinc-700 border-zinc-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500">{LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                                    <div><label htmlFor="mood" className="block text-sm font-medium text-zinc-400">Mod</label><select id="mood" value={mood} onChange={e => setMood(e.target.value)} className="mt-1 block w-full bg-zinc-700 border-zinc-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 capitalize">{MOODS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                                    <div><label htmlFor="theme" className="block text-sm font-medium text-zinc-400">Tema</label><input type="text" id="theme" value={theme} onChange={e => setTheme(e.target.value)} placeholder="Örn: Ein Tag in Berlin" className="mt-1 block w-full bg-zinc-700 border-zinc-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500" /></div>
                                    <div><label htmlFor="wordCount" className="block text-sm font-medium text-zinc-400">Kelime Sayısı (~{wordCount})</label><input type="range" id="wordCount" min="100" max="1000" step="50" value={wordCount} onChange={e => setWordCount(Number(e.target.value))} className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"/></div>
                                </div>
                                <button onClick={() => handleGenerate(level, theme, mood)} disabled={isLoading || !theme.trim()} className="mt-6 w-full bg-yellow-400 text-zinc-900 font-bold py-3 px-4 rounded-lg hover:bg-yellow-300 transition flex items-center justify-center gap-2 disabled:bg-zinc-600 disabled:cursor-not-allowed">{isLoading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}<span>Oluştur</span></button>
                                <button onClick={handleGenerateRandom} disabled={isLoading} className="mt-3 w-full bg-zinc-700 text-zinc-100 font-bold py-3 px-4 rounded-lg hover:bg-zinc-600 transition flex items-center justify-center gap-2 disabled:bg-zinc-600 disabled:cursor-not-allowed"><WandSparklesIcon className="w-5 h-5" /><span>Beni Şaşırt</span></button>
                                {generatedText && !isLoading && <button onClick={handleStartNewStory} className="mt-3 w-full bg-zinc-700 text-zinc-100 font-bold py-3 px-4 rounded-lg hover:bg-zinc-600 transition flex items-center justify-center gap-2"><PlusCircleIcon className="w-5 h-5" /><span>Yeni Hikaye Başlat</span></button>}
                            </div>
                        </aside>
                        <div className="w-full lg:w-2/3 xl:w-3/4">{renderMainContent()}</div>
                    </div>
                )}
                {view === 'favorites' && (
                    learningModeList ? (
                        <LearningModeQuiz list={learningModeList} level={level} onFinish={() => setLearningModeList(null)} />
                    ) : (
                        <FavoritesPage 
                            savedTexts={savedTexts} 
                            favoriteLists={favoriteLists}
                            onLoadText={handleLoadText} 
                            onDeleteText={handleDeleteText} 
                            onExportTexts={handleExportTexts}
                            onCreateList={handleCreateList}
                            onDeleteList={handleDeleteList}
                            onRemoveWord={handleRemoveWordFromList}
                            onStartLearningMode={(list) => setLearningModeList(list)}
                            level={level}
                        />
                    )
                )}
            </main>
        </div>
    );
}

// --- New Components ---

const AddToListModal: React.FC<{ modalData: { german: string, turkish: string, x: number, y: number }, lists: FavoriteList[], onCreateList: (name: string) => FavoriteList | undefined, onAddWord: (word: FavoriteWord, listId: string) => void, modalRef: React.RefObject<HTMLDivElement>}> = ({ modalData, lists, onCreateList, onAddWord, modalRef }) => {
    const [newListName, setNewListName] = useState('');
    const handleCreateAndAdd = () => {
        const newList = onCreateList(newListName);
        if (newList) {
            onAddWord({ german: modalData.german, turkish: modalData.turkish }, newList.id);
        }
    };
    return (
        <div ref={modalRef} className="fixed bg-zinc-800 border border-yellow-400 p-4 rounded-lg shadow-2xl z-50 flex flex-col gap-2" style={{ left: modalData.x, top: modalData.y, maxWidth: '250px' }}>
            <h4 className="font-bold text-yellow-400">Listeye Ekle</h4>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                {lists.length > 0 ? lists.map(list => (
                    <button key={list.id} onClick={() => onAddWord({ german: modalData.german, turkish: modalData.turkish }, list.id)} className="w-full text-left p-2 bg-zinc-700 hover:bg-zinc-600 rounded transition">{list.name}</button>
                )) : <p className="text-sm text-zinc-400">Henüz listeniz yok.</p>}
            </div>
            <div className="mt-2 pt-2 border-t border-zinc-700">
                <input type="text" value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Yeni liste adı..." className="w-full bg-zinc-700 border-zinc-600 rounded-md py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500" />
                <button onClick={handleCreateAndAdd} disabled={!newListName.trim()} className="w-full mt-2 bg-yellow-400 text-zinc-900 text-sm font-bold py-1 rounded hover:bg-yellow-300 transition disabled:bg-zinc-600">Oluştur ve Ekle</button>
            </div>
        </div>
    )
}

const FavoritesPage: React.FC<{ savedTexts: SavedText[], favoriteLists: FavoriteList[], onLoadText: (text: SavedText) => void, onDeleteText: (text: SavedText) => void, onExportTexts: () => void, onCreateList: (name: string) => void, onDeleteList: (id: string) => void, onRemoveWord: (word: string, listId: string) => void, onStartLearningMode: (list: FavoriteList) => void, level: CEFRLevel }> = ({ savedTexts, favoriteLists, onLoadText, onDeleteText, onExportTexts, onCreateList, onDeleteList, onRemoveWord, onStartLearningMode, level }) => {
    const [newListName, setNewListName] = useState('');
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section>
                <div className="bg-zinc-800 p-6 rounded-lg shadow-lg">
                   <h3 className="text-xl font-bold text-yellow-400 mb-4">Favori Kelime Listelerim</h3>
                   <div className="flex gap-2 mb-4">
                        <input type="text" value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Yeni liste adı..." className="flex-grow bg-zinc-700 border-zinc-600 rounded-md py-2 px-3 focus:outline-none focus:ring-1 focus:ring-yellow-500" />
                        <button onClick={() => { onCreateList(newListName); setNewListName(''); }} disabled={!newListName.trim()} className="bg-yellow-400 text-zinc-900 font-bold p-2 rounded-lg hover:bg-yellow-300 transition disabled:bg-zinc-600"><PlusCircleIcon className="w-6 h-6"/></button>
                   </div>
                   <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                        {favoriteLists.length > 0 ? favoriteLists.map(list => <WordList key={list.id} list={list} onDeleteList={onDeleteList} onRemoveWord={onRemoveWord} onStartLearningMode={onStartLearningMode} level={level}/>) : <p className="text-sm text-zinc-500">Henüz kelime listeniz yok.</p>}
                   </div>
                </div>
            </section>
            <section>
                <div className="bg-zinc-800 p-6 rounded-lg shadow-lg">
                   <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xl font-bold text-yellow-400">Kayıtlı Metinler</h3>
                     <button onClick={onExportTexts} disabled={savedTexts.length === 0} title="Tümünü Dışa Aktar" className="p-1 disabled:text-zinc-600 text-zinc-400 hover:text-yellow-400 transition"><ArrowDownTrayIcon className="w-5 h-5" /></button>
                   </div>
                   <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                    {savedTexts.length > 0 ? savedTexts.map((text, i) => (
                        <div key={i} className="p-3 bg-zinc-700/50 rounded-md"><p className="font-semibold">{text.title} <span className="text-xs text-zinc-400">({text.level})</span></p><p className="text-sm text-zinc-400 truncate">{getPreview(text.text)}</p><div className="flex items-center gap-2 mt-2"><button onClick={() => onLoadText(text)} className="text-xs font-semibold text-yellow-400 hover:underline">Yükle</button><button onClick={() => onDeleteText(text)} className="text-xs text-red-400 hover:underline">Sil</button></div></div>
                    )) : <p className="text-sm text-zinc-500">Henüz kayıtlı metin yok.</p>}
                   </div>
                </div>
            </section>
        </div>
    );
};

const WordList: React.FC<{ list: FavoriteList, onDeleteList: (id: string) => void, onRemoveWord: (word: string, listId: string) => void, onStartLearningMode: (list: FavoriteList) => void, level: CEFRLevel }> = ({ list, onDeleteList, onRemoveWord, onStartLearningMode, level }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [sortedWords, setSortedWords] = useState(list.words);
    const [isSorted, setIsSorted] = useState(false);
    const [expandedWord, setExpandedWord] = useState<string | null>(null);

    useEffect(() => {
        setSortedWords(list.words);
        setIsSorted(false);
    }, [list.words]);

    const toggleSort = () => {
        if(isSorted) {
            setSortedWords(list.words);
        } else {
            setSortedWords([...list.words].sort((a,b) => a.german.localeCompare(b.german)));
        }
        setIsSorted(!isSorted);
    }
    
    return (
        <div className="p-3 bg-zinc-700/50 rounded-md">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <h4 className="font-semibold">{list.name} <span className="text-xs text-zinc-400">({list.words.length} kelime)</span></h4>
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onDeleteList(list.id); }} className="p-1 text-zinc-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                    <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                </div>
            </div>
            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-zinc-600/50">
                    <div className="flex justify-end items-center gap-2 mb-2">
                         <button onClick={toggleSort} className="text-xs px-2 py-1 bg-zinc-600 rounded hover:bg-zinc-500">{isSorted ? 'Sıralamayı Kaldır' : 'A-Z Sırala'}</button>
                        <button onClick={() => onStartLearningMode(list)} disabled={list.words.length === 0} className="text-xs font-semibold px-2 py-1 bg-yellow-500 text-zinc-900 rounded hover:bg-yellow-400 disabled:bg-zinc-500">Öğrenme Modu</button>
                    </div>
                    {sortedWords.map(word => (
                        <div key={word.german} className="border-b border-zinc-600/50 py-2">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedWord(expandedWord === word.german ? null : word.german)}>
                                <div>
                                    <p className="font-semibold text-zinc-200">{word.german}</p>
                                    <p className="text-sm text-yellow-500 capitalize">{word.turkish}</p>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); onRemoveWord(word.german, list.id); }} className="p-1 text-zinc-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                            {expandedWord === word.german && <WordExplanationView word={word} level={level} />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
};

const WordExplanationView: React.FC<{ word: FavoriteWord, level: CEFRLevel }> = ({ word, level }) => {
    const [explanation, setExplanation] = useState<WordExplanation | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string|null>(null);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        geminiService.explainAndExampleWord(word.german, level)
            .then(setExplanation)
            .catch(err => setError(err.message || 'Açıklama alınamadı.'))
            .finally(() => setIsLoading(false));
    }, [word, level]);

    return (
        <div className="mt-2 p-3 bg-zinc-900/50 rounded">
            {isLoading && <p className="text-sm text-zinc-400">Açıklama ve örnekler getiriliyor...</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}
            {explanation && (
                <div className="space-y-2 text-sm">
                    <p className="text-zinc-300">{explanation.explanation}</p>
                    <ul className="list-disc list-inside space-y-1 pl-2 text-zinc-400">
                        {explanation.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                    </ul>
                </div>
            )}
        </div>
    )
}

const LearningModeQuiz: React.FC<{ list: FavoriteList, level: CEFRLevel, onFinish: () => void }> = ({ list, level, onFinish }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string|null>(null);
    const [clozeData, setClozeData] = useState<{ clozeText: string; answers: string[] } | null>(null);
    const [userAnswers, setUserAnswers] = useState<string[]>([]);
    const [showResult, setShowResult] = useState(false);
    const [mcq, setMcq] = useState<{[key: number]: string[]}>({});
    const [fetchingMcq, setFetchingMcq] = useState<number|null>(null);

    useEffect(() => {
        geminiService.generateClozeTest(list.words, level)
            .then(data => {
                setClozeData(data);
                setUserAnswers(new Array(data.answers.length).fill(''));
            })
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [list, level]);

    const handleAnswerChange = (index: number, value: string) => {
        const newAnswers = [...userAnswers];
        newAnswers[index] = value;
        setUserAnswers(newAnswers);
    };

    const fetchMcq = async (index: number) => {
        if (!clozeData) return;
        setFetchingMcq(index);
        try {
            const contextSentence = clozeData.clozeText.replace(/\[___\]/g, "___");
            const distractors = await geminiService.generateDistractors(clozeData.answers[index], contextSentence);
            const options = [...distractors, clozeData.answers[index]].sort(() => Math.random() - 0.5);
            setMcq(prev => ({...prev, [index]: options}));
        } catch(err) {
            console.error(err);
        } finally {
            setFetchingMcq(null);
        }
    }

    if (isLoading) return <div className="p-8 bg-zinc-800 rounded-lg shadow-lg text-center"><ArrowPathIcon className="w-8 h-8 mx-auto animate-spin text-yellow-400" /><p className="mt-2">Öğrenme modu hazırlanıyor...</p></div>;
    if (error || !clozeData) return <div className="p-8 bg-zinc-800 rounded-lg shadow-lg text-center"><p className="text-red-400">{error || "Test oluşturulamadı."}</p><button onClick={onFinish} className="mt-4 bg-zinc-700 px-4 py-2 rounded-lg">Geri Dön</button></div>;
    
    const clozeParts = clozeData.clozeText.split('[___]');

    return (
        <div className="p-8 bg-zinc-800 rounded-lg shadow-lg max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-yellow-400 mb-4">Öğrenme Modu: {list.name}</h3>
            <div className="text-lg leading-loose bg-zinc-900 p-6 rounded-lg">
                {clozeParts.map((part, i) => (
                    <React.Fragment key={i}>
                        {part}
                        {i < clozeData.answers.length && (
                            <div className="inline-block mx-2 align-bottom">
                                <input type="text" value={userAnswers[i]} onChange={e => handleAnswerChange(i, e.target.value)} disabled={showResult} className={`bg-zinc-700 border-2 rounded p-1 w-40 text-center ${showResult ? (userAnswers[i].toLowerCase().trim() === clozeData.answers[i].toLowerCase().trim() ? 'border-green-500' : 'border-red-500') : 'border-zinc-600 focus:border-yellow-400'} outline-none transition`} />
                                {showResult && userAnswers[i].toLowerCase().trim() !== clozeData.answers[i].toLowerCase().trim() && <span className="text-xs text-green-400 block text-center">({clozeData.answers[i]})</span>}
                                {!showResult && <button onClick={() => fetchMcq(i)} disabled={fetchingMcq === i} className="ml-1 text-zinc-400 hover:text-yellow-400 text-xs"> yardım? </button>}
                                {mcq[i] && !showResult && <div className="flex gap-1 mt-1">{mcq[i].map(opt => <button key={opt} onClick={() => handleAnswerChange(i, opt)} className="text-xs px-2 py-1 bg-zinc-600 rounded hover:bg-zinc-500">{opt}</button>)}</div>}
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
            <div className="mt-6 flex justify-between items-center">
                <button onClick={onFinish} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition">Bitir</button>
                <button onClick={() => setShowResult(!showResult)} className="px-6 py-2 font-bold rounded-lg bg-yellow-400 text-zinc-900 hover:bg-yellow-300 transition">{showResult ? 'Düzelt' : 'Kontrol Et'}</button>
            </div>
        </div>
    )
};

const TextClozeTestView: React.FC<{ clozeData: { clozeText: string; answers: string[] }, onFinish: () => void }> = ({ clozeData, onFinish }) => {
    const [userAnswers, setUserAnswers] = useState<string[]>(new Array(clozeData.answers.length).fill(''));
    const [showResult, setShowResult] = useState(false);

    const handleAnswerChange = (index: number, value: string) => {
        const newAnswers = [...userAnswers];
        newAnswers[index] = value;
        setUserAnswers(newAnswers);
    };

    const clozeParts = clozeData.clozeText.split('[___]');

    return (
        <div className="p-8 bg-zinc-800 rounded-lg shadow-lg">
            <h3 className="text-2xl font-bold text-yellow-400 mb-4">Öğrenme Modu: Boşluk Doldurma</h3>
            <div className="text-lg leading-loose bg-zinc-900 p-6 rounded-lg">
                {clozeParts.map((part, i) => (
                    <React.Fragment key={i}>
                        {part}
                        {i < clozeData.answers.length && (
                            <div className="inline-block mx-2 align-bottom">
                                <input 
                                    type="text" 
                                    value={userAnswers[i]} 
                                    onChange={e => handleAnswerChange(i, e.target.value)} 
                                    disabled={showResult} 
                                    className={`bg-zinc-700 border-2 rounded p-1 w-40 text-center ${showResult ? (userAnswers[i].toLowerCase().trim() === clozeData.answers[i].toLowerCase().trim() ? 'border-green-500' : 'border-red-500') : 'border-zinc-600 focus:border-yellow-400'} outline-none transition`} 
                                    aria-label={`Boşluk ${i + 1}`}
                                />
                                {showResult && userAnswers[i].toLowerCase().trim() !== clozeData.answers[i].toLowerCase().trim() && (
                                    <span className="text-xs text-green-400 block text-center">({clozeData.answers[i]})</span>
                                )}
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
            <div className="mt-6 flex justify-between items-center">
                <button onClick={onFinish} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition">Bitir</button>
                <button onClick={() => setShowResult(!showResult)} className="px-6 py-2 font-bold rounded-lg bg-yellow-400 text-zinc-900 hover:bg-yellow-300 transition">{showResult ? 'Düzelt' : 'Kontrol Et'}</button>
            </div>
        </div>
    );
};

const QuizView: React.FC<{ questions: QuizQuestion[], score: number | null, currentQuestionIndex: number, answers: {[key: number]: string}, onAnswer: (qIndex: number, answer: string) => void, onSubmit: () => void, onReset: () => void, onNavigate: (index: number) => void }> = ({ questions, score, currentQuestionIndex, answers, onAnswer, onSubmit, onReset, onNavigate }) => {
    if (questions.length === 0) return null;
    if(score !== null) {
        const incorrectAnswers = questions.map((q, i) => ({...q, index: i})).filter((q, i) => answers[i] !== q.correctAnswer);
        return (
            <div className="p-8 bg-zinc-800 rounded-lg shadow-lg">
                <div className="text-center"><h3 className="text-2xl font-bold mb-4 text-yellow-400">Bilgini Sına Tamamlandı!</h3><p className="text-xl mb-6">Skorun: {score} / {questions.length}</p><button onClick={onReset} className="bg-yellow-400 text-zinc-900 px-6 py-2 rounded-lg hover:bg-yellow-300 font-bold transition">Tekrar Dene</button></div>
                {incorrectAnswers.length > 0 && (
                    <div className="mt-8 border-t border-zinc-700 pt-6"><h4 className="text-lg font-semibold mb-4 text-red-400">Hatalı Cevapların</h4><ul className="space-y-4">{incorrectAnswers.map((q) => (<li key={q.index} className="p-3 bg-zinc-700/50 rounded-md"><p className="font-semibold mb-2">{q.index + 1}. {q.question}</p><p className="text-red-400">- Senin Cevabın: {answers[q.index]}</p><p className="text-green-400">- Doğru Cevap: {q.correctAnswer}</p></li>))}</ul></div>
                )}
            </div>
        )
    }
    const question = questions?.[currentQuestionIndex];
    if (!question) return <div className="p-6 bg-zinc-800 rounded-lg shadow-lg text-center text-zinc-400">Soru yüklenemedi.</div>;

    return (
        <div className="p-6 bg-zinc-800 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold mb-2 text-yellow-400">Bilgini Sına</h3>
            <p className="text-sm text-zinc-400 mb-4">Soru {currentQuestionIndex + 1}/{questions.length}</p>
            <p className="mb-6 text-lg">{question.question ?? 'Soru metni bulunamadı.'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{question.options?.map((option, i) => (<button key={i} onClick={() => onAnswer(currentQuestionIndex, option)} className={`p-4 rounded-lg border-2 text-left transition ${answers[currentQuestionIndex] === option ? 'bg-yellow-400/20 border-yellow-400' : 'border-zinc-700 hover:bg-zinc-700/50 hover:border-zinc-600'}`}>{option}</button>))}</div>
            <div className="mt-6 flex justify-between">
                <button onClick={() => onNavigate(Math.max(0, currentQuestionIndex - 1))} disabled={currentQuestionIndex === 0} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50">Geri</button>
                {currentQuestionIndex < questions.length - 1 ? (
                     <button onClick={() => onNavigate(Math.min(questions.length - 1, currentQuestionIndex + 1))} className="px-4 py-2 rounded-lg bg-yellow-400 text-zinc-900 font-semibold hover:bg-yellow-300">İleri</button>
                ) : (
                     <button onClick={onSubmit} disabled={Object.keys(answers).length !== questions.length} className="px-4 py-2 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-400 disabled:opacity-50 disabled:bg-zinc-600">Testi Bitir</button>
                )}
            </div>
        </div>
    )
};

export default App;