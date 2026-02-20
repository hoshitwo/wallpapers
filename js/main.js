/**
 * Answer - iPhone Wallpaper Gallery
 * メインスクリプト (Pixabay API版)
 */

'use strict';

// ============================================
// Configuration
// ============================================
const CONFIG = {
    // Pixabay API
    PIXABAY_API_KEY: '54724759-5d0fe4647307d61d0042d23f9',
    PIXABAY_BASE: 'https://pixabay.com/api/',
    
    // Picsum API
    PICSUM_BASE: 'https://picsum.photos',
    
    // iPhone 15 Pro Max の壁紙サイズ
    WALLPAPER_WIDTH: 1290,
    WALLPAPER_HEIGHT: 2796,
    
    // 履歴の最大保持数
    MAX_HISTORY: 50,
    
    // プリフェッチする画像数
    PREFETCH_COUNT: 5,
    
    // 1回のAPI呼び出しで取得する画像数
    IMAGES_PER_REQUEST: 20,
    
    // Pixabayの使用比率 (0.0 - 1.0)
    PIXABAY_RATIO: 0.5,
};

// ============================================
// State
// ============================================
const state = {
    currentIndex: 0,
    history: [],
    isLoading: false,
    currentImageUrl: null,
    currentImageData: null,
    currentSource: null, // 'pixabay' or 'picsum'
    preloadedImages: new Map(), // プリロード済み画像のキャッシュ
    imagePool: [], // APIから取得した画像プール
    usedImageIds: new Set(), // 使用済み画像ID（重複防止）
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    loader: document.getElementById('loader'),
    spinner: document.getElementById('spinner'),
    overlay: document.querySelector('.overlay'),
    wallpaper: document.getElementById('wallpaper'),
    wallpaperNext: document.getElementById('wallpaper-next'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnShare: document.getElementById('btn-share'),
    logoText: document.querySelector('.logo-text'),
    header: document.querySelector('.header'),
    controls: document.querySelector('.controls'),
    sourceText: document.querySelector('.source-text'),
};

// ============================================
// Pixabay API Functions
// ============================================

/**
 * Pixabay APIから画像を取得
 */
async function fetchImagesFromPixabay() {
    // ランダムなページを選択（1-50の範囲）
    const randomPage = Math.floor(Math.random() * 50) + 1;
    
    const params = new URLSearchParams({
        key: CONFIG.PIXABAY_API_KEY,
        image_type: 'photo',
        orientation: 'vertical', // 縦向き画像のみ
        min_height: 1920, // 高解像度のみ
        safesearch: 'true',
        per_page: CONFIG.IMAGES_PER_REQUEST,
        page: randomPage,
        order: 'popular', // 人気順
    });
    
    try {
        const response = await fetch(`${CONFIG.PIXABAY_BASE}?${params}`);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 未使用の画像のみをフィルタリング
        const newImages = data.hits.filter(img => !state.usedImageIds.has(img.id));
        
        return newImages;
    } catch (error) {
        console.error('Pixabay API エラー:', error);
        return [];
    }
}

/**
 * 画像プールを補充
 */
async function refillImagePool() {
    if (state.imagePool.length < CONFIG.PREFETCH_COUNT) {
        const newImages = await fetchImagesFromPixabay();
        state.imagePool.push(...newImages);
    }
}

/**
 * Picsumから画像データを生成
 */
function generatePicsumImage() {
    const seed = Date.now() + Math.random();
    const url = `${CONFIG.PICSUM_BASE}/seed/${seed}/1080/2340`;
    return {
        id: `picsum_${seed}`,
        largeImageURL: url,
        source: 'picsum',
    };
}

/**
 * 画像プールから次の画像を取得（Pixabay/Picsum混合）
 */
async function getNextImageFromPool() {
    // 50%の確率でPixabayまたはPicsumを選択
    const usePixabay = Math.random() < CONFIG.PIXABAY_RATIO;
    
    if (usePixabay) {
        // Pixabayから取得
        if (state.imagePool.length === 0) {
            await refillImagePool();
        }
        
        const imageData = state.imagePool.shift();
        
        if (imageData) {
            state.usedImageIds.add(imageData.id);
            
            // プールが少なくなったらバックグラウンドで補充
            if (state.imagePool.length < CONFIG.PREFETCH_COUNT) {
                refillImagePool();
            }
            
            return { ...imageData, source: 'pixabay' };
        }
    }
    
    // Picsumから取得（Pixabayが空の場合もフォールバック）
    return generatePicsumImage();
}

// ============================================
// Wallpaper Functions
// ============================================

/**
 * 画像をプリロード
 */
function preloadImage(url) {
    // キャッシュにあればそれを返す
    if (state.preloadedImages.has(url)) {
        return Promise.resolve(state.preloadedImages.get(url));
    }
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            state.preloadedImages.set(url, img);
            resolve(img);
        };
        img.onerror = reject;
        img.src = url;
    });
}

/**
 * 次の画像を先読み
 */
async function prefetchNextImages() {
    for (let i = 0; i < CONFIG.PREFETCH_COUNT; i++) {
        const imageData = await getNextImageFromPool();
        if (imageData) {
            const url = imageData.largeImageURL;
            state.history.push({
                url: url,
                data: imageData,
            });
            
            // バックグラウンドでプリロード（エラーは無視）
            preloadImage(url).catch(() => {});
        }
    }
}

/**
 * ロゴのローディング状態を制御
 */
function setLogoLoading(loading) {
    if (loading) {
        elements.logoText.classList.add('shimmer');
    } else {
        elements.logoText.classList.remove('shimmer');
    }
}

/**
 * ソース表示を更新
 */
function updateSourceDisplay(source) {
    if (elements.sourceText) {
        if (source === 'pixabay') {
            elements.sourceText.textContent = 'via Pixabay';
        } else {
            elements.sourceText.textContent = 'via Unsplash';
        }
    }
}

/**
 * 壁紙を読み込んで表示
 */
async function loadWallpaper(direction = 'next') {
    if (state.isLoading) return;
    state.isLoading = true;

    try {
        let imageUrl;
        let imageData;
        
        if (direction === 'prev' && state.currentIndex > 0) {
            // 前の画像（履歴から）
            state.currentIndex--;
            const historyItem = state.history[state.currentIndex];
            imageUrl = historyItem.url;
            imageData = historyItem.data;
        } else if (direction === 'next') {
            // 次の画像
            state.currentIndex++;
            
            if (state.currentIndex < state.history.length) {
                // 履歴に次がある場合（プリフェッチ済み）
                const historyItem = state.history[state.currentIndex];
                imageUrl = historyItem.url;
                imageData = historyItem.data;
            } else {
                // 新しい画像を取得
                const newImageData = await getNextImageFromPool();
                if (newImageData) {
                    imageUrl = newImageData.largeImageURL;
                    imageData = newImageData;
                    state.history.push({
                        url: imageUrl,
                        data: imageData,
                    });
                } else {
                    throw new Error('画像の取得に失敗しました');
                }
            }
            
            // 残りのプリフェッチ画像が少なくなったら追加でプリフェッチ
            const remainingPrefetched = state.history.length - state.currentIndex - 1;
            if (remainingPrefetched < CONFIG.PREFETCH_COUNT) {
                prefetchNextImages();
            }
            
            // 履歴の最大数を超えたら古いものを削除
            if (state.history.length > CONFIG.MAX_HISTORY) {
                state.history.shift();
                state.currentIndex--;
            }
        }

        // ロゴをシマー表示（読み込み中）
        setLogoLoading(true);
        
        // ステップ1: 現在の画像をフェードアウト（黒へ）
        elements.wallpaper.style.transition = 'opacity 0.5s ease';
        elements.wallpaper.style.opacity = '0';
        
        // フェードアウト完了を待つ
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // ステップ2: 画像をプリロード
        await preloadImage(imageUrl);
        
        // ステップ3: 新しい画像を設定（まだ非表示のまま）
        elements.wallpaper.style.transition = 'none';
        elements.wallpaper.style.backgroundImage = `url(${imageUrl})`;
        
        // ブラウザに確実にレンダリングさせる
        await new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    resolve();
                });
            });
        });
        
        // さらに少し待機して画像描画を確実に
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // ステップ4: 新しい画像をフェードイン（黒から）
        elements.wallpaper.style.transition = 'opacity 0.8s ease-out';
        elements.wallpaper.style.opacity = '1';
        
        state.currentImageUrl = imageUrl;
        state.currentImageData = imageData;
        state.currentSource = imageData.source;
        
        // ソース表示を更新
        updateSourceDisplay(imageData.source);
        
        // フェードイン完了を待つ（トランジション時間 + バッファ）
        await new Promise(resolve => setTimeout(resolve, 900));
        
        // フェードイン完了後にロゴのアニメーション停止
        setLogoLoading(false);

        // 前へボタンの状態更新
        elements.btnPrev.style.opacity = state.currentIndex > 0 ? '0.6' : '0.2';
        elements.btnPrev.style.pointerEvents = state.currentIndex > 0 ? 'auto' : 'none';

    } catch (error) {
        console.error('画像の読み込みに失敗しました:', error);
        setLogoLoading(false);
    } finally {
        state.isLoading = false;
    }
}

/**
 * 壁紙を共有
 */
async function shareWallpaper() {
    if (!state.currentImageUrl) return;

    // ローディング状態を表示
    elements.btnShare.classList.add('loading');
    elements.btnShare.style.pointerEvents = 'none';
    
    try {
        // Pixabayの高解像度画像URL
        const hdUrl = state.currentImageData?.largeImageURL || state.currentImageUrl;
        
        // Web Share API が使えるか確認
        if (navigator.share && navigator.canShare) {
            // 画像をfetchしてBlobに
            const response = await fetch(hdUrl);
            const blob = await response.blob();
            const file = new File([blob], 'wallpaper.jpg', { type: 'image/jpeg' });
            
            // ファイル共有がサポートされているか確認
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file]
                });
            } else {
                // ファイル共有非対応の場合はURLを共有
                await navigator.share({
                    title: 'WALLPAPERS',
                    url: hdUrl
                });
            }
        } else if (navigator.share) {
            // 基本的なシェアのみ対応
            await navigator.share({
                title: 'WALLPAPERS',
                url: hdUrl
            });
        } else {
            // Web Share API が使えない場合は画像を新しいタブで開く
            window.open(hdUrl, '_blank');
        }

    } catch (error) {
        // ユーザーがキャンセルした場合は無視
        if (error.name !== 'AbortError') {
            console.error('共有に失敗しました:', error);
            // フォールバック: 新しいタブで開く
            const hdUrl = state.currentImageData?.largeImageURL || state.currentImageUrl;
            window.open(hdUrl, '_blank');
        }
    } finally {
        // ローディング状態を解除
        elements.btnShare.classList.remove('loading');
        elements.btnShare.style.pointerEvents = '';
    }
}

// ============================================
// Event Handlers
// ============================================

function setupEventListeners() {
    // ボタンクリック
    elements.btnPrev.addEventListener('click', () => loadWallpaper('prev'));
    elements.btnNext.addEventListener('click', () => loadWallpaper('next'));
    elements.btnShare.addEventListener('click', shareWallpaper);

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowLeft':
                loadWallpaper('prev');
                break;
            case 'ArrowRight':
            case ' ':
                e.preventDefault();
                loadWallpaper('next');
                break;
            case 's':
            case 'S':
                shareWallpaper();
                break;
        }
    });

    // スワイプ対応（モバイル）
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const diff = touchStartX - touchEndX;
        const threshold = 50;
        
        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                // 左スワイプ → 次へ
                loadWallpaper('next');
            } else {
                // 右スワイプ → 前へ
                loadWallpaper('prev');
            }
        }
    }
}

// ============================================
// Initialization
// ============================================

async function init() {
    try {
        // APIから初期画像を取得
        await refillImagePool();
        
        // 初期の壁紙を読み込み
        await loadWallpaper('next');
        
        // 次の画像をバックグラウンドでプリフェッチ
        prefetchNextImages();
        
        // ローダーを非表示
        elements.loader.classList.add('hidden');
        
        // UIをフェードイン（初回ロード時のみ）
        requestAnimationFrame(() => {
            elements.header.classList.add('loaded');
            elements.controls.classList.add('loaded');
        });
        
        // イベントリスナーを設定
        setupEventListeners();
        
        console.log('🖼️ Wallpapers Gallery (Pixabay) が起動しました');
        
    } catch (error) {
        console.error('初期化エラー:', error);
        // エラー時はPicsumにフォールバック
        alert('画像の読み込みに失敗しました。ページを再読み込みしてください。');
    }
}

// DOM Ready
document.addEventListener('DOMContentLoaded', init);
