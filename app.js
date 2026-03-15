// PWA Service Workerの登録
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

let editor;
let tabs = [];
let activeTabId = null;

// トースト通知関数
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// データの復元
const savedData = localStorage.getItem('mobileCodeProState');
if (savedData) {
    const state = JSON.parse(savedData);
    tabs = state.tabs || [];
    activeTabId = state.activeTabId || null;
}
if (tabs.length === 0) addTab("index.js", "// ここにコードを書いてください");
if (!activeTabId && tabs.length > 0) activeTabId = tabs[0].id;

// Monaco Editor 初期化
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('editor-container'), {
        theme: 'vs-dark',
        language: 'javascript',
        automaticLayout: true,
        wordWrap: 'on',
        minimap: { enabled: true, scale: 0.7 },
        lineNumbers: 'on',
        fontSize: 14,
        padding: { top: 10 },
        scrollBeyondLastLine: false,
        folding: true,
        renderLineHighlight: 'all',
        contextmenu: false // モバイルでの誤爆を防ぐためネイティブメニューを無効化
    });

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

// タブ管理
function addTab(name, content = "") {
    const newId = Date.now().toString();
    tabs.push({ id: newId, name: name, content: content });
    activeTabId = newId;
    saveStateToLocal();
    if (editor) { renderTabs(); loadTabContent(newId); }
}

function loadTabContent(id) {
    const tab = tabs.find(t => t.id === id);
    if (tab && editor) {
        const ext = tab.name.split('.').pop();
        const langMap = { 'js':'javascript', 'html':'html', 'css':'css', 'json':'json', 'py':'python' };
        monaco.editor.setModelLanguage(editor.getModel(), langMap[ext] || 'plaintext');
        if (editor.getValue() !== tab.content) editor.setValue(tab.content);
    }
}

function renderTabs() {
    const tabsContainer = document.getElementById('tabs');
    tabsContainer.innerHTML = '';
    tabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
        tabEl.innerHTML = `<span class="tab-name">${tab.name}</span><span class="tab-close"><i class="fas fa-times"></i></span>`;
        
        tabEl.querySelector('.tab-name').onclick = () => {
            activeTabId = tab.id; renderTabs(); loadTabContent(activeTabId); saveStateToLocal();
        };
        tabEl.querySelector('.tab-close').onclick = (e) => {
            e.stopPropagation();
            tabs = tabs.filter(t => t.id !== tab.id);
            if (tabs.length === 0) addTab("untitled.txt", "");
            else if (activeTabId === tab.id) activeTabId = tabs[tabs.length - 1].id;
            renderTabs(); loadTabContent(activeTabId); saveStateToLocal();
        };
        tabsContainer.appendChild(tabEl);
    });
}

function saveStateToLocal() {
    localStorage.setItem('mobileCodeProState', JSON.stringify({ tabs, activeTabId }));
}

// ------------------------------------
// UIボタンのアクション
// ------------------------------------
document.getElementById('btn-new-tab').onclick = () => {
    const name = prompt("ファイル名を入力してください", "newfile.js");
    if (name) addTab(name);
};

// 【新規】ファイルを開く
document.getElementById('btn-open').onclick = () => {
    document.getElementById('file-input').click();
};
document.getElementById('file-input').addEventListener('change', (e) => {
    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (event) => addTab(file.name, event.target.result);
        reader.readAsText(file);
    }
    e.target.value = ''; // リセット
});

// 【新規】全選択
document.getElementById('btn-select-all').onclick = () => {
    if (!editor) return;
    editor.setSelection(editor.getModel().getFullModelRange());
    editor.focus();
    showToast("全選択しました");
};

// 【新規】コピー
document.getElementById('btn-copy').onclick = async () => {
    if (!editor) return;
    const text = editor.getModel().getValueInRange(editor.getSelection());
    if (text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast("コピーしました");
        } catch (err) { alert("コピー失敗: " + err); }
    }
};

// 【新規】カット (切り取り)
document.getElementById('btn-cut').onclick = async () => {
    if (!editor) return;
    const selection = editor.getSelection();
    const text = editor.getModel().getValueInRange(selection);
    if (text) {
        try {
            await navigator.clipboard.writeText(text);
            editor.executeEdits("", [{ range: selection, text: null }]);
            showToast("切り取りました");
        } catch (err) { alert("カット失敗: " + err); }
    }
};

// 【新規】ペースト
document.getElementById('btn-paste').onclick = async () => {
    if (!editor) return;
    try {
        const text = await navigator.clipboard.readText();
        const selection = editor.getSelection();
        editor.executeEdits("", [{ range: selection, text: text, forceMoveMarkers: true }]);
        editor.focus();
        showToast("ペーストしました");
    } catch (err) { alert("ペースト権限を許可してください"); }
};

// その他
document.getElementById('btn-search').onclick = () => editor.getAction('actions.find').run();
document.getElementById('btn-replace').onclick = () => editor.getAction('editor.action.startFindReplaceAction').run();
document.getElementById('btn-save').onclick = () => { saveStateToLocal(); showToast("保存しました"); };
document.getElementById('btn-rename').onclick = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const newName = prompt("新しいファイル名", activeTab.name);
    if (newName) { activeTab.name = newName; renderTabs(); loadTabContent(activeTabId); saveStateToLocal(); }
};
document.getElementById('btn-save-as').onclick = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(new Blob([activeTab.content], { type: "text/plain" }));
    a.download = activeTab.name;
    a.click();
    showToast("ダウンロードを開始しました");
};
