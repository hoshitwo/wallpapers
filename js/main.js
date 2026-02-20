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
};

// ============================================
// State
// ============================================
const state = {
    currentIndex: 0,
    history: [],
    isLoading: false,
    currentImageUrl: null,
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    loader: document.getElementById('loader'),
    spinner: document.getElementById('spinner'),
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
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = reject;
        img.src = url;
    });
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
    
    // スピナー表示
    showSpinner(true);

    try {
        let imageUrl;
        
        if (direction === 'prev' && state.currentIndex > 0) {
            // 前の画像（履歴から）
            state.currentIndex--;
            imageUrl = state.history[state.currentIndex];
        } else if (direction === 'next') {
            // 次の画像
            if (state.currentIndex < state.history.length - 1) {
                // 履歴に次がある場合
                state.currentIndex++;
                imageUrl = state.history[state.currentIndex];
            } else {
                // 新しい画像を取得
                imageUrl = generateWallpaperUrl();
                state.history.push(imageUrl);
                state.currentIndex = state.history.length - 1;
                
                // 履歴の最大数を超えたら古いものを削除
                if (state.history.length > CONFIG.MAX_HISTORY) {
                    state.history.shift();
                    state.currentIndex--;
                }
            }
        }

        // 画像をプリロード
        await preloadImage(imageUrl);
        
        // スピナー非表示
        showSpinner(false);
        
        // トランジション
        elements.wallpaperNext.style.backgroundImage = `url(${imageUrl})`;
        elements.wallpaper.classList.add('fade-out');
        elements.wallpaperNext.classList.add('fade-in');
        
        // トランジション完了後に入れ替え
        setTimeout(() => {
            elements.wallpaper.style.backgroundImage = `url(${imageUrl})`;
            elements.wallpaper.classList.remove('fade-out');
            elements.wallpaperNext.classList.remove('fade-in');
            state.currentImageUrl = imageUrl;
            // html/bodyにも背景を設定（セーフエリア対策）
            document.documentElement.style.backgroundImage = `url(${imageUrl})`;
            document.body.style.backgroundImage = `url(${imageUrl})`;
        }, 800);

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

    // フィードバック
    elements.btnShare.style.transform = 'scale(0.9)';
    
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
        setTimeout(() => {
            elements.btnShare.style.transform = '';
        }, 200);
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
    
    // 初期背景をhtml/bodyにも設定
    if (state.currentImageUrl) {
        document.documentElement.style.backgroundImage = `url(${state.currentImageUrl})`;
        document.body.style.backgroundImage = `url(${state.currentImageUrl})`;
    }
    
    // ローダーを非表示
    elements.loader.classList.add('hidden');
    
    // イベントリスナーを設定
    setupEventListeners();
    
    console.log('🖼️ Answer Wallpaper Gallery が起動しました');
}

// DOM Ready
document.addEventListener('DOMContentLoaded', init);
