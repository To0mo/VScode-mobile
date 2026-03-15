// モジュールをCDNから直接インポート (ビルド不要)
import { basicSetup } from "https://esm.sh/codemirror";
import { EditorView, keymap } from "https://esm.sh/@codemirror/view";
import { EditorState } from "https://esm.sh/@codemirror/state";
import { javascript } from "https://esm.sh/@codemirror/lang-javascript";
import { html } from "https://esm.sh/@codemirror/lang-html";
import { css } from "https://esm.sh/@codemirror/lang-css";
import { python } from "https://esm.sh/@codemirror/lang-python";
import { search, openSearchPanel } from "https://esm.sh/@codemirror/search";
import { oneDark } from "https://esm.sh/@codemirror/theme-one-dark";
import { minimap } from "https://esm.sh/@replit/codemirror-minimap";

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

let view; // エディタのビューインスタンス
let tabs = [];
let activeTabId = null;

// 通知関数
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// 拡張子から言語を判定
function getLanguage(filename) {
    const ext = filename.split('.').pop();
    switch(ext) {
        case 'js': case 'json': return javascript();
        case 'html': return html();
        case 'css': return css();
        case 'py': return python();
        default: return []; // その他はプレーンテキスト
    }
}

// エディタの状態(State)を作成する関数
function createEditorState(content, filename) {
    return EditorState.create({
        doc: content,
        extensions: [
            basicSetup,
            oneDark,                  // ダークテーマ
            EditorView.lineWrapping,  // スマホ画面で折り返し
            getLanguage(filename),    // 言語ハイライト
            search({ top: true }),    // 検索・置換パネルを上部に
            minimap(),                // ★ミニマップ有効化
            // 変更があったら自動保存
            EditorView.updateListener.of((update) => {
                if (update.docChanged) saveToLocal();
            })
        ]
    });
}

// ローカルストレージから復元
const savedData = localStorage.getItem('mobileCodeProV3');
if (savedData) {
    const state = JSON.parse(savedData);
    tabs = state.tabs || [];
    activeTabId = state.activeTabId || null;
}
if (tabs.length === 0) addTab("index.js", "// 長押しでスマホ標準の選択ができます\nfunction hello() {\n  console.log('Mobile Native Select!');\n}");
if (!activeTabId && tabs.length > 0) activeTabId = tabs[0].id;

// エディタを画面にマウント
view = new EditorView({
    parent: document.getElementById('editor-container')
});

renderTabs();
loadTab(activeTabId);

// ---------------------------
// タブ・ファイル管理ロジック
// ---------------------------
function addTab(name, content = "") {
    const newId = Date.now().toString();
    tabs.push({ id: newId, name: name, content: content });
    activeTabId = newId;
    saveToLocal();
    renderTabs();
    loadTab(newId);
}

function loadTab(id) {
    const tab = tabs.find(t => t.id === id);
    if (tab) {
        // タブ切り替え時にStateを丸ごと入れ替える（超高速）
        view.setState(createEditorState(tab.content, tab.name));
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
            activeTabId = tab.id; renderTabs(); loadTab(activeTabId);
        };
        tabEl.querySelector('.tab-close').onclick = (e) => {
            e.stopPropagation();
            tabs = tabs.filter(t => t.id !== tab.id);
            if (tabs.length === 0) addTab("untitled.txt", "");
            else if (activeTabId === tab.id) activeTabId = tabs[tabs.length - 1].id;
            renderTabs(); loadTab(activeTabId); saveToLocal();
        };
        tabsContainer.appendChild(tabEl);
    });
}

function saveToLocal() {
    // 現在のエディタのテキストを取得してタブ情報に上書き
    if (activeTabId && view) {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab) tab.content = view.state.doc.toString();
    }
    localStorage.setItem('mobileCodeProV3', JSON.stringify({ tabs, activeTabId }));
}

// ---------------------------
// UIボタンのアクション
// ---------------------------
document.getElementById('btn-new-tab').onclick = () => {
    const name = prompt("ファイル名", "newfile.js");
    if (name) addTab(name);
};

document.getElementById('btn-open').onclick = () => document.getElementById('file-input').click();
document.getElementById('file-input').addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => addTab(file.name, event.target.result);
        reader.readAsText(file);
    });
    e.target.value = '';
});

document.getElementById('btn-save').onclick = () => {
    saveToLocal(); showToast("保存しました");
};

// ★検索・置換パネルを呼び出す
document.getElementById('btn-search').onclick = () => {
    openSearchPanel(view);
};

document.getElementById('btn-rename').onclick = () => {
    const tab = tabs.find(t => t.id === activeTabId);
    const newName = prompt("新しいファイル名", tab.name);
    if (newName) {
        tab.name = newName;
        renderTabs(); loadTab(activeTabId); saveToLocal();
    }
};

document.getElementById('btn-save-as').onclick = () => {
    const tab = tabs.find(t => t.id === activeTabId);
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(new Blob([tab.content], { type: "text/plain" }));
    a.download = tab.name;
    a.click();
    showToast("ダウンロードしました");
};
