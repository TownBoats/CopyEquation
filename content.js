let isChatGPT = location.host == "ai.44vl.cc";
let isAndroid = /(android)/i.test(navigator.userAgent);
let isWindows = /(windows)/i.test(navigator.userAgent);
const parser = new DOMParser();

insertCSS('contextMenu');
insertCSS(isChatGPT ? 'chatgpt' : 'wikipedia');
if (isAndroid) insertCSS('android');
document.addEventListener("contextmenu", (event) => {
  event.preventDefault(); // 阻止浏览器自带的上下文菜单
});
function insertCSS(name) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL(`css/${name}.css`);
  document.head.appendChild(link);
}

function fetchContent(path, callback) {
  fetch(chrome.runtime.getURL(path))
    .then(response => response.text())
    .then(content => callback(content))
    .catch(error => console.error(`Error fetching content: ${error}`));
}

function fetchSVGContent(name, callback) {
  fetchContent(`svg/${name}.svg`, callback);
}

document.addEventListener("click", removeContextMenu);
document.addEventListener("keydown", removeContextMenu);
if (!isAndroid) window.addEventListener("resize", removeContextMenu);
if (!isChatGPT && !isAndroid) document.addEventListener("scroll", removeContextMenu);

let contextMenu, chat, isChatLoaded, putX, putY;
window.updateChat = () => {};

let androidChat = () => document.querySelector("[class^='react-scroll-to-bottom']:not(.h-full)");
function updateScroll() {
  document.getElementById("contextMenu").style.top = putY + window.initialScroll - androidChat().scrollTop + "px";
}

fetchSVGContent('word', (wordSvgContent) => {
  fetchSVGContent('latex', (latexSvgContent) => {
    fetchSVGContent('copyMathML', (copyMathMLContent) => { // 新增MathML图标
      if (!isAndroid) document.addEventListener("contextmenu", openContextMenu);
      if (isAndroid) document.addEventListener("click", openContextMenu);

      // 识别含字母的段落
      identifyTextSegments();

      // Experimental
      window.updateChat = () => {
        if (isChatGPT)
          isChatLoaded = setInterval(() => {
            chat = document.getElementsByClassName("pb-9")[0]?.parentElement; 
            if (chat) {
              clearInterval(isChatLoaded);
              chat.addEventListener("scroll", removeContextMenu);
              [...document.getElementsByClassName(isAndroid ? "agent-turn" : "pt-0.5")].forEach((e) => {
                if (isAndroid) e = e.querySelector(".font-semibold");
                if (!e.querySelector(".copy_eq_btn")) {
                  e.innerHTML += isWindows ? wordSvgContent + latexSvgContent : latexSvgContent;
                  [...e.querySelectorAll(".copy_eq_btn")].forEach((elem, index) => elem.addEventListener("click", () => {
                    copyAll(isAndroid ? e.nextSibling : e.parentElement.parentElement.nextSibling, isAndroid ? "copyLaTeX" : (index == 0 ? "copyMathML" : "copyLaTeX"));
                  }));
                }
              })
            }
          }, 10);
      };

      function openContextMenu(event) {
        removeContextMenu();
        let Element = isChatGPT ? findKatexElement(event.clientX, event.clientY) : findMweElement(event.clientX, event.clientY);
        let TextElement = findTextSegment(event.clientX, event.clientY); // 新增文本段落检测
        if (Element || TextElement) {
          event.preventDefault();

          if (isAndroid) {
            window.initialScroll = androidChat().scrollTop;
            androidChat().addEventListener("scroll", updateScroll);
          }

          let contextMenuHTML = `<div id="contextMenu" ${isAndroid ? '' : 'desktop'} style="left: ${putX}px; top: ${putY + window.scrollY}px;">`;

          if (Element) {
            contextMenuHTML += `
              <div id="copyMathML">${wordSvgContent + (isAndroid ? "" : "Copy for Word (MathML)")}</div>
              <div id="copyLaTeX">${latexSvgContent + (isAndroid ? "" : "Copy LaTeX")}</div>`;
          }

          if (TextElement) { // 新增MathML复制选项
            contextMenuHTML += `
              <div id="copyTextWithMathML">${copyMathMLContent + " 复制带MathML的字母"}</div>`;
          }

          contextMenuHTML += `</div>`;

          contextMenu = document.createElement('div');
          contextMenu.innerHTML = contextMenuHTML;
          document.body.appendChild(contextMenu);

          if (Element) {
            document.getElementById("copyMathML").addEventListener("click", () => {
              checkAndCopy(Element, "copyMathML");
            });

            document.getElementById("copyLaTeX").addEventListener("click", () => {
              checkAndCopy(Element, "copyLaTeX");
            });
          }

          if (TextElement) { // 新增事件绑定
            document.getElementById("copyTextWithMathML").addEventListener("click", () => {
              copyTextWithMathML(TextElement);
            });
          }
        }
      }

      updateChat();
    })
  })
})

// 新增函数：识别含字母的段落
function identifyTextSegments() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walker.nextNode()) {
    if (/[A-Za-z]/.test(node.textContent)) {
      const parent = node.parentElement;
      if (!parent.classList.contains('mathml-text-segment')) {
        parent.classList.add('mathml-text-segment');
      }
    }
  }
}

// 新增函数：查找文本段落元素
function findTextSegment(x, y) {
  const elements = document.getElementsByClassName('mathml-text-segment');
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      putX = isAndroid ? rect.right + 7 : x;
      putY = isAndroid ? rect.top - 23 - document.body.clientHeight : y;
      return element;
    }
  }
  return null;
}

// 新增函数：复制文本中带MathML的字母
function copyTextWithMathML(element) {
  const text = element.textContent;
  const processedContent = text.replace(/([A-Za-z])/g, match => {
    return `<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>${match}</mi></math>`;
  });
  copyToClipboard(processedContent);
}

// 保持现有的removeContextMenu函数不变
function removeContextMenu() {
  updateChat();
  contextMenu?.remove();
  androidChat().removeEventListener("scroll", updateScroll)
}

// 现有的辅助函数保持不变
function isWithin(x, y, classNames, func) {
  let elements = [];
  classNames.forEach((e) => {elements = elements.concat([...document.getElementsByClassName(e)])});
  for (const element of elements) {
    let rect = element.getBoundingClientRect();

    if (x >= rect.left - 1 && x <= rect.right + 1 && y >= rect.top - 1 && y <= rect.bottom + 1) {
      putX = isAndroid ? rect.right + 7 : x;
      putY = isAndroid ? rect.top - 23 - document.body.clientHeight : y;
      return func(element);
    }
  }
  return null;
}

const findMweElement = (x, y) => isWithin(x, y, ["mwe-math-fallback-image-inline", "mwe-math-fallback-image-display"], (e) => e.parentElement),
      findKatexElement = (x, y) => isWithin(x, y, ["katex"], (e) => e),
      format = (string, type) => (type == "copyLaTeX" ? `$${string}$` : string);

function addBreaks(string, array) {
  array.forEach((e) => { string = string.replaceAll(e[0], `${e[2] ? e[2] : ""}${e[0]}${"\n".repeat(e[1])}`) })
  return string;
}

fetchContent("popup.html", (popupHTML) => {
  window.copyAll = (element, type) => {
    if (type == "copyMathML") {
      chrome.storage.sync.get(null, (e) => {
        if (!e["usedbefore"]) {
          document.body.innerHTML += popupHTML;
          chrome.storage.sync.set({ usedbefore: true });
        }
      });
    }

    let doc = parser.parseFromString(element.innerHTML, 'text/html');
    [...doc.querySelectorAll(".math")].forEach((e) => {
      let string = check(e, type)
        .replaceAll("&lt;", "&amp;lt;")
        .replaceAll("&gt;", "&amp;gt;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      let bool = e.classList.contains("math-display");
      if (type == "copyLaTeX")
        e.outerHTML = bool ? `\\begin{equation*}\n${string.replaceAll("align*", "aligned")}\n\\end{equation*}\n\n` : `$${string}$`;
      else 
        e.outerHTML = bool ? `${string}\n` : string;
    });

    [...doc.querySelectorAll("pre > .rounded-md")].forEach((e) => {
      let header = e.querySelector(".rounded-t-md");
      let lang = header.querySelector("span").textContent;
      if (type == "copyLaTeX") {
        header.outerHTML = `\\begin{minted}{${lang}}\n`;
        e.outerHTML += "\\end{minted}\n\n";
      } else header.remove();
    });

    doc.body.outerHTML = addBreaks(doc.body.outerHTML, [
      ["</p>", 2],
      ["</li>", 1],
      ["<ul>", 1],
      ["</ul>", 1],
      ["<ol>", 1],
      ["</ol>", 1],
      ["</pre>", 1],
      ["<li>", 0, "- "]
    ]).replaceAll(/<\/h([1-6])>/g, "</h$1>\n\n");

    doc.querySelector(".mt-1 > .p-1")?.remove();
    doc.querySelector(".mt-1.flex.gap-3")?.remove();

    let string = doc.body.textContent;

    if (type == "copyMathML")
      string = string
        .replaceAll(/<\/math>\n+/g, "</math>\n")
        .replaceAll(/<\/math>\n*<math/g, "</math>\n\n<math")
    else
      string = string.replaceAll("$\\displaystyle$", "\\\\displaystyle");

    copyToClipboard(string.replaceAll(/\n{3,}/g, "\n\n"));
  }
})

function check(element, type) {
  if (type === "copyMathML") {
    if (element.querySelector("annotation").textContent == "\\displaystyle")
      return "\\displaystyle";
    return element.querySelector("math").outerHTML
      .replaceAll("&nbsp;", " ")
      .replaceAll("&amp;", "&")
      .replaceAll(/<annotation [\S\s]*?>[\S\s]*?<\/annotation>/g, "");
  }
  if (type === "copyLaTeX") {
      let latex = element.querySelector("annotation").textContent;
      let matches = latex.match(/\\displaystyle{([\S\s]*?)}/s);
      return (matches ? matches[1] : latex).replace("\\displaystyle", "");
  }
}

function checkAndCopy(element, type) {
  copyToClipboard(check(element, type))
}

function copyToClipboard(text) {
  function listener(e) {
    e.clipboardData.setData("text/plain", text.trim());
    e.preventDefault();
  }
  document.addEventListener("copy", listener);
  document.execCommand("copy");
  document.removeEventListener("copy", listener);
}
