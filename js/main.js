/**
 * Answer - iPhone Wallpaper Gallery
 * メインスクリプト
 */

'use strict';

// ============================================
// Configuration
// ============================================
const CONFIG = {
    // Unsplash API (後でAPIキーを設定)
    // UNSPLASH_ACCESS_KEY: 'YOUR_ACCESS_KEY',
    
    // Picsum API (APIキー不要で使用可能)
    PICSUM_BASE: 'https://picsum.photos',
    
    // iPhone 15 Pro Max の壁紙サイズ
    WALLPAPER_WIDTH: 1290,
    WALLPAPER_HEIGHT: 2796,
    
    // 履歴の最大保持数
    MAX_HISTORY: 50,
    
    // プリフェッチする画像数
    PREFETCH_COUNT: 3,
};

// ============================================
// State
// ============================================
const state = {
    currentIndex: 0,
    history: [],
    isLoading: false,
    currentImageUrl: null,
    preloadedImages: new Map(), // プリロード済み画像のキャッシュ
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
};

// ============================================
// Wallpaper Functions
// ============================================

/**
 * ランダムな壁紙URLを生成
 */
function generateWallpaperUrl() {
    const seed = Date.now() + Math.random();
    // 縦長の画像を取得（iPhone壁紙向け）
    return `${CONFIG.PICSUM_BASE}/seed/${seed}/1080/2340`;
}

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
    const startIndex = state.history.length;
    
    for (let i = 0; i < CONFIG.PREFETCH_COUNT; i++) {
        const url = generateWallpaperUrl();
        state.history.push(url);
        
        // バックグラウンドでプリロード（エラーは無視）
        preloadImage(url).catch(() => {});
    }
}

/**
 * 画像から主要な色を抽出
 */
function extractDominantColor(img) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // サンプリング用に小さくリサイズ
        const sampleSize = 50;
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imageData.data;
        
        let r = 0, g = 0, b = 0;
        let count = 0;
        
        // 上部と下部のピクセルをサンプリング
        for (let y = 0; y < sampleSize; y++) {
            // 上部10%と下部10%のみ
            if (y < sampleSize * 0.1 || y > sampleSize * 0.9) {
                for (let x = 0; x < sampleSize; x++) {
                    const i = (y * sampleSize + x) * 4;
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    count++;
                }
            }
        }
        
        // 平均色を計算（少し暗めに調整）
        r = Math.floor((r / count) * 0.7);
        g = Math.floor((g / count) * 0.7);
        b = Math.floor((b / count) * 0.7);
        
        return `${r}, ${g}, ${b}`;
    } catch (e) {
        console.error('色抽出エラー:', e);
        return '0, 0, 0';
    }
}

/**
 * グラデーションの色を更新
 */
function updateGradientColor(color) {
    if (elements.overlay) {
        elements.overlay.style.setProperty('--gradient-color', color);
    }
}

/**
 * スピナーを表示/非表示
 */
function showSpinner(show) {
    if (show) {
        elements.spinner.classList.remove('hidden');
    } else {
        elements.spinner.classList.add('hidden');
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
        let isPrefetched = false;
        
        if (direction === 'prev' && state.currentIndex > 0) {
            // 前の画像（履歴から）
            state.currentIndex--;
            imageUrl = state.history[state.currentIndex];
            isPrefetched = state.preloadedImages.has(imageUrl);
        } else if (direction === 'next') {
            // 次の画像
            state.currentIndex++;
            
            if (state.currentIndex < state.history.length) {
                // 履歴に次がある場合（プリフェッチ済み）
                imageUrl = state.history[state.currentIndex];
                isPrefetched = state.preloadedImages.has(imageUrl);
            } else {
                // 新しい画像を取得
                imageUrl = generateWallpaperUrl();
                state.history.push(imageUrl);
                isPrefetched = false;
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

        // ステップ1: 現在の画像をフェードアウト（黒へ）
        elements.wallpaper.style.transition = 'opacity 0.4s ease';
        elements.wallpaper.style.opacity = '0';
        
        // フェードアウト完了を待つ
        await new Promise(resolve => setTimeout(resolve, 400));
        
        // スピナー表示
        showSpinner(true);
        
        // ステップ2: 画像をプリロード（プリフェッチ済みならすぐ完了）
        // 最低300ms表示してリッチ感を出す
        const [img] = await Promise.all([
            preloadImage(imageUrl),
            new Promise(resolve => setTimeout(resolve, 300))
        ]);
        
        // スピナー非表示
        showSpinner(false);
        
        // ステップ3: 新しい画像を設定（まだ非表示）
        elements.wallpaper.style.transition = 'none';
        elements.wallpaper.style.backgroundImage = `url(${imageUrl})`;
        elements.wallpaper.offsetHeight; // リフロー
        
        // ステップ4: 新しい画像をフェードイン（黒から）
        elements.wallpaper.style.transition = 'opacity 0.5s ease';
        elements.wallpaper.style.opacity = '1';
        
        state.currentImageUrl = imageUrl;
        
        // フェードイン完了を待つ
        await new Promise(resolve => setTimeout(resolve, 500));

        // 前へボタンの状態更新
        elements.btnPrev.style.opacity = state.currentIndex > 0 ? '1' : '0.3';
        elements.btnPrev.style.pointerEvents = state.currentIndex > 0 ? 'auto' : 'none';

    } catch (error) {
        console.error('画像の読み込みに失敗しました:', error);
        showSpinner(false);
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
        // 高解像度版のURLを生成
        const hdUrl = state.currentImageUrl.replace('/1080/2340', `/${CONFIG.WALLPAPER_WIDTH}/${CONFIG.WALLPAPER_HEIGHT}`);
        
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
            const hdUrl = state.currentImageUrl.replace('/1080/2340', `/${CONFIG.WALLPAPER_WIDTH}/${CONFIG.WALLPAPER_HEIGHT}`);
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
    // 初期の壁紙を読み込み
    await loadWallpaper('next');
    
    // 次の画像をバックグラウンドでプリフェッチ
    prefetchNextImages();
    
    // ローダーを非表示
    elements.loader.classList.add('hidden');
    
    // イベントリスナーを設定
    setupEventListeners();
    
    console.log('🖼️ Answer Wallpaper Gallery が起動しました');
}

// DOM Ready
document.addEventListener('DOMContentLoaded', init);
