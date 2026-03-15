// PWA Service Workerの登録
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}

let editor;
let tabs = [];
let activeTabId = null;

// ローカルストレージからデータを復元
const savedData = localStorage.getItem('mobileCodeProState');
if (savedData) {
    const state = JSON.parse(savedData);
    tabs = state.tabs || [];
    activeTabId = state.activeTabId || null;
}

// 初期タブがない場合は作成
if (tabs.length === 0) {
    addTab("index.js", "// ここにコードを書いてください\nconsole.log('Hello, World!');");
}
if (!activeTabId && tabs.length > 0) activeTabId = tabs[0].id;

// Monaco Editorの初期化
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('editor-container'), {
        theme: 'vs-dark',
        language: 'javascript',
        automaticLayout: true,
        wordWrap: 'on',           // モバイル用：画面端で折り返し
        minimap: { enabled: true, scale: 0.7 }, // ミニマップ有効化
        lineNumbers: 'on',
        fontSize: 14,
        padding: { top: 10 },
        scrollBeyondLastLine: false,
        folding: true,
        renderLineHighlight: 'all'
    });

    // エディタの内容が変更されたら状態を保存
    editor.onDidChangeModelContent(() => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab) {
            activeTab.content = editor.getValue();
            saveStateToLocal();
        }
    });

    renderTabs();
    loadTabContent(activeTabId);
});

// タブ管理関数
function addTab(name, content = "") {
    const newId = Date.now().toString();
    tabs.push({ id: newId, name: name, content: content });
    activeTabId = newId;
    saveStateToLocal();
    if (editor) {
        renderTabs();
        loadTabContent(newId);
    }
}

function loadTabContent(id) {
    const tab = tabs.find(t => t.id === id);
    if (tab && editor) {
        // 拡張子から言語を推測
        const ext = tab.name.split('.').pop();
        const langMap = { 'js':'javascript', 'html':'html', 'css':'css', 'json':'json', 'py':'python' };
        const lang = langMap[ext] || 'plaintext';
        
        monaco.editor.setModelLanguage(editor.getModel(), lang);
        if (editor.getValue() !== tab.content) {
            editor.setValue(tab.content);
        }
    }
}

function renderTabs() {
    const tabsContainer = document.getElementById('tabs');
    tabsContainer.innerHTML = '';
    
    tabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
        tabEl.innerHTML = `
            <span class="tab-name">${tab.name}</span>
            <span class="tab-close"><i class="fas fa-times"></i></span>
        `;
        
        // タブ切り替え
        tabEl.querySelector('.tab-name').onclick = () => {
            activeTabId = tab.id;
            renderTabs();
            loadTabContent(activeTabId);
            saveStateToLocal();
        };

        // タブを閉じる
        tabEl.querySelector('.tab-close').onclick = (e) => {
            e.stopPropagation();
            tabs = tabs.filter(t => t.id !== tab.id);
            if (tabs.length === 0) addTab("untitled.txt", "");
            else if (activeTabId === tab.id) activeTabId = tabs[tabs.length - 1].id;
            renderTabs();
            loadTabContent(activeTabId);
            saveStateToLocal();
        };

        tabsContainer.appendChild(tabEl);
    });
}

// 状態保存
function saveStateToLocal() {
    localStorage.setItem('mobileCodeProState', JSON.stringify({ tabs, activeTabId }));
}

// UIボタンのアクション
document.getElementById('btn-new-tab').onclick = () => {
    const name = prompt("ファイル名を入力してください", "newfile.js");
    if (name) addTab(name);
};

document.getElementById('btn-search').onclick = () => {
    editor.getAction('actions.find').run(); // Monacoのネイティブ検索機能呼び出し
};

document.getElementById('btn-replace').onclick = () => {
    editor.getAction('editor.action.startFindReplaceAction').run(); // ネイティブ置換機能
};

document.getElementById('btn-save').onclick = () => {
    saveStateToLocal();
    alert("ローカル環境に保存しました (PWAキャッシュ)");
};

document.getElementById('btn-rename').onclick = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const newName = prompt("新しいファイル名", activeTab.name);
    if (newName) {
        activeTab.name = newName;
        renderTabs();
        loadTabContent(activeTabId); // 言語ハイライトを更新
        saveStateToLocal();
    }
};

document.getElementById('btn-save-as').onclick = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const blob = new Blob([activeTab.content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeTab.name;
    a.click();
    window.URL.revokeObjectURL(url);
};
