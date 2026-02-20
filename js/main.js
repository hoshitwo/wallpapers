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
    // フィルター設定
    filters: {
        unsplash: true,
        pixabay: true,
        categories: ['animals', 'backgrounds', 'buildings', 'business', 'computer', 'education', 'fashion', 'feelings', 'food', 'health', 'industry', 'music', 'nature', 'people', 'places', 'religion', 'science', 'sports', 'transportation', 'travel'],
    },
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
    sourceName: document.querySelector('.source-name'),
    sourceCategory: document.querySelector('.source-category'),
    // フィルター関連
    btnFilter: document.getElementById('btn-filter'),
    filterModal: document.getElementById('filter-modal'),
    filterBackdrop: document.getElementById('filter-backdrop'),
    filterUnsplash: document.getElementById('filter-unsplash'),
    filterPixabay: document.getElementById('filter-pixabay'),
    filterCategories: document.getElementById('filter-categories'),
    btnCancel: document.getElementById('btn-cancel'),
    btnSave: document.getElementById('btn-save'),
};

// ============================================
// Pixabay API Functions
// ============================================

/**
 * Pixabay APIから画像を取得
 */
async function fetchImagesFromPixabay() {
    // 選択されたカテゴリーからランダムに1つ選ぶ
    const categories = state.filters.categories;
    if (categories.length === 0) {
        return [];
    }
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    
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
        category: randomCategory, // カテゴリーフィルター
    });
    
    try {
        const response = await fetch(`${CONFIG.PIXABAY_BASE}?${params}`);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 未使用の画像のみをフィルタリング + カテゴリー名を追加
        const newImages = data.hits
            .filter(img => !state.usedImageIds.has(img.id))
            .map(img => ({ ...img, category: randomCategory }));
        
        return newImages;
    } catch (error) {
        console.error('Pixabay API エラー:', error);
        return [];
    }
}

/**
 * 画像プールを補充（複数カテゴリーから取得してシャッフル）
 */
async function refillImagePool() {
    if (state.imagePool.length < CONFIG.PREFETCH_COUNT) {
        const categories = state.filters.categories;
        
        if (categories.length === 0) {
            return;
        }
        
        // 複数のカテゴリーから画像を取得
        const numCategoriesToFetch = Math.min(5, categories.length);
        const shuffledCategories = [...categories].sort(() => Math.random() - 0.5);
        const selectedCategories = shuffledCategories.slice(0, numCategoriesToFetch);
        
        // 各カテゴリーから並行で取得
        const fetchPromises = selectedCategories.map(category => 
            fetchImagesFromPixabayByCategory(category)
        );
        
        const results = await Promise.all(fetchPromises);
        const allImages = results.flat();
        
        // シャッフルしてプールに追加
        const shuffledImages = allImages.sort(() => Math.random() - 0.5);
        state.imagePool.push(...shuffledImages);
    }
}

/**
 * 指定カテゴリーからPixabay画像を取得
 */
async function fetchImagesFromPixabayByCategory(category) {
    const randomPage = Math.floor(Math.random() * 50) + 1;
    
    const params = new URLSearchParams({
        key: CONFIG.PIXABAY_API_KEY,
        image_type: 'photo',
        orientation: 'vertical',
        min_height: 1920,
        safesearch: 'true',
        per_page: 5, // 各カテゴリーから5枚ずつ
        page: randomPage,
        order: 'popular',
        category: category,
    });
    
    try {
        const response = await fetch(`${CONFIG.PIXABAY_BASE}?${params}`);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        return data.hits
            .filter(img => !state.usedImageIds.has(img.id))
            .map(img => ({ ...img, category: category }));
    } catch (error) {
        console.error(`Pixabay API エラー (${category}):`, error);
        return [];
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
    const { unsplash, pixabay, categories } = state.filters;
    
    // どちらも無効の場合はエラー
    if (!unsplash && !pixabay) {
        console.warn('少なくとも1つのソースを有効にしてください');
        return generatePicsumImage();
    }
    
    // 有効なソースからランダムに選択
    let usePixabay = false;
    if (unsplash && pixabay && categories.length > 0) {
        usePixabay = Math.random() < CONFIG.PIXABAY_RATIO;
    } else if (pixabay && categories.length > 0) {
        usePixabay = true;
    } else {
        usePixabay = false;
    }
    
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
 * PCビューかどうかを判定
 */
function isDesktopView() {
    return window.innerWidth >= 768 && window.matchMedia('(hover: hover)').matches;
}

/**
 * 画像から色を抽出してグラデーションを更新（PCのみ）
 */
function updateGradientFromImage(imageUrl) {
    if (!isDesktopView()) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // サンプリング用に小さいサイズで描画
            const sampleSize = 50;
            canvas.width = sampleSize;
            canvas.height = sampleSize;
            
            ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
            
            // 上部の色を抽出（上から10%の領域）
            const topData = ctx.getImageData(0, 0, sampleSize, Math.floor(sampleSize * 0.1));
            const topColor = getAverageColor(topData.data);
            
            // 下部の色を抽出（下から10%の領域）
            const bottomData = ctx.getImageData(0, Math.floor(sampleSize * 0.9), sampleSize, Math.floor(sampleSize * 0.1));
            const bottomColor = getAverageColor(bottomData.data);
            
            // 色を少し暗めに調整
            const darkenedTop = darkenColor(topColor, 0.3);
            const darkenedBottom = darkenColor(bottomColor, 0.3);
            
            // CSSカスタムプロパティを更新
            elements.overlay.style.setProperty('--gradient-top', `rgba(${darkenedTop.r}, ${darkenedTop.g}, ${darkenedTop.b}, 0.8)`);
            elements.overlay.style.setProperty('--gradient-bottom', `rgba(${darkenedBottom.r}, ${darkenedBottom.g}, ${darkenedBottom.b}, 0.8)`);
            
            // 少し遅延してからグラデーションをフェードイン
            setTimeout(() => {
                elements.overlay.classList.add('visible');
            }, 100);
        } catch (e) {
            // CORS エラーなどの場合は無視
            console.log('Could not extract colors from image');
        }
    };
    
    img.src = imageUrl;
}

/**
 * ピクセルデータから平均色を取得
 */
function getAverageColor(data) {
    let r = 0, g = 0, b = 0;
    const pixelCount = data.length / 4;
    
    for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
    }
    
    return {
        r: Math.round(r / pixelCount),
        g: Math.round(g / pixelCount),
        b: Math.round(b / pixelCount)
    };
}

/**
 * 色を暗く調整
 */
function darkenColor(color, factor) {
    return {
        r: Math.round(color.r * (1 - factor)),
        g: Math.round(color.g * (1 - factor)),
        b: Math.round(color.b * (1 - factor))
    };
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
function updateSourceDisplay(imageData) {
    if (elements.sourceName) {
        if (imageData.source === 'pixabay') {
            elements.sourceName.textContent = 'Pixabay';
            // カテゴリー名を表示
            if (elements.sourceCategory) {
                elements.sourceCategory.textContent = imageData.category || '';
            }
        } else {
            elements.sourceName.textContent = 'Unsplash';
            if (elements.sourceCategory) {
                elements.sourceCategory.textContent = '';
            }
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
        
        // PCビューの場合、グラデーションを即座に非表示
        if (isDesktopView()) {
            elements.overlay.classList.remove('visible');
        }
        
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
        updateSourceDisplay(imageData);
        
        // PCビューの場合、画像から色を抽出してグラデーションを更新
        updateGradientFromImage(imageUrl);
        
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
            case 'Escape':
                closeFilterModal();
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
        // フィルターモーダルが開いている場合はスワイプを無視
        if (!elements.filterModal.classList.contains('hidden')) {
            return;
        }
        
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
    
    // フィルター関連
    setupFilterListeners();
}

// ============================================
// Filter Functions
// ============================================

function openFilterModal() {
    elements.filterModal.classList.remove('hidden');
    updateSaveButtonState();
}

function closeFilterModal() {
    elements.filterModal.classList.add('hidden');
}

function updateSaveButtonState() {
    // Unsplash と Pixabay の両方がオフの場合は Save を無効化
    const canSave = elements.filterUnsplash.checked || elements.filterPixabay.checked;
    elements.btnSave.disabled = !canSave;
}

function setupFilterListeners() {
    // フィルターボタン
    elements.btnFilter.addEventListener('click', openFilterModal);
    
    // 背景クリックで閉じる
    elements.filterBackdrop.addEventListener('click', closeFilterModal);
    
    // Unsplashチェックボックス - Saveボタンの状態を更新
    elements.filterUnsplash.addEventListener('change', updateSaveButtonState);
    
    // Pixabayチェックボックス - カテゴリーの有効/無効を切り替え + Saveボタンの状態を更新
    elements.filterPixabay.addEventListener('change', (e) => {
        if (e.target.checked) {
            elements.filterCategories.classList.remove('disabled');
        } else {
            elements.filterCategories.classList.add('disabled');
        }
        updateSaveButtonState();
    });
    
    // キャンセルボタン
    elements.btnCancel.addEventListener('click', closeFilterModal);
    
    // 保存ボタン
    elements.btnSave.addEventListener('click', saveFilters);
}

async function saveFilters() {
    // フィルター設定を取得
    state.filters.unsplash = elements.filterUnsplash.checked;
    state.filters.pixabay = elements.filterPixabay.checked;
    
    // カテゴリー設定を取得
    const categoryCheckboxes = elements.filterCategories.querySelectorAll('input[data-category]');
    state.filters.categories = [];
    categoryCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            state.filters.categories.push(checkbox.dataset.category);
        }
    });
    
    // 画像プールを完全にクリア
    clearImagePool();
    
    // モーダルを閉じる
    closeFilterModal();
    
    // 新しいフィルター設定でプールを補充
    await refillImagePool();
    
    // 新しいフィルターで画像を取得
    await loadWallpaper('next');
}

function clearImagePool() {
    // フィルター変更時にプールと履歴をクリア
    state.imagePool = [];
    state.usedImageIds.clear();
    state.history = [];
    state.currentIndex = -1;
    // プリロードキャッシュもクリア
    state.preloadedImages.clear();
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
