const ALLOWED_TAGS = new Set(["b", "i", "u", "a", "br", "strong", "em"]);
const ALLOWED_ATTRS = new Set(["href", "title", "target"]);

export function sanitizeHtml(html: string): string {
  return html.replace(/<[^>]*>/g, (tag) => {
    const lower = tag.toLowerCase();
    if (lower.startsWith("</")) {
      const tagName = lower.slice(2, -1).trim().split(/\s+/)[0];
      return ALLOWED_TAGS.has(tagName) ? tag : "";
    }
    if (lower.startsWith("<br")) return "<br>";
    const match = lower.match(/^<(\w+)/);
    if (!match) return "";
    const tagName = match[1];
    if (!ALLOWED_TAGS.has(tagName)) return "";
    const attrs: string[] = [];
    const attrRe = /(\w+)\s*=\s*"([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrRe.exec(tag)) !== null) {
      if (ALLOWED_ATTRS.has(attrMatch[1])) {
        attrs.push(`${attrMatch[1]}="${attrMatch[2].replace(/"/g, "&quot;")}"`);
      }
    }
    return attrs.length ? `<${tagName} ${attrs.join(" ")}>` : `<${tagName}>`;
  });
}
