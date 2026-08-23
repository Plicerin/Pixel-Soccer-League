export function sanitizeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'capture';
}

function copyComputedStyles(source: Element, target: Element) {
  const sourceStyle = window.getComputedStyle(source);
  const targetElement = target as HTMLElement;

  for (const property of sourceStyle) {
    targetElement.style.setProperty(
      property,
      sourceStyle.getPropertyValue(property),
      sourceStyle.getPropertyPriority(property),
    );
  }
}

async function inlineImageSources(source: HTMLElement, clone: HTMLElement) {
  const sourceImages = Array.from(source.querySelectorAll('img'));
  const cloneImages = Array.from(clone.querySelectorAll('img'));

  await Promise.all(sourceImages.map(async (image, index) => {
    const cloneImage = cloneImages[index];
    if (!cloneImage || !image.currentSrc) return;
    if (image.currentSrc.startsWith('data:')) {
      cloneImage.src = image.currentSrc;
      return;
    }
    try {
      const response = await fetch(image.currentSrc);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read image blob'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
      cloneImage.src = dataUrl;
    } catch {
      cloneImage.removeAttribute('src');
      cloneImage.style.display = 'none';
    }
  }));
}

function inlineDomTree(source: HTMLElement, clone: HTMLElement) {
  const sourceNodes = [source, ...Array.from(source.querySelectorAll('*'))];
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll('*'))];

  sourceNodes.forEach((sourceNode, index) => {
    const cloneNode = cloneNodes[index];
    if (!cloneNode) return;
    copyComputedStyles(sourceNode, cloneNode);

    if (sourceNode instanceof HTMLInputElement && cloneNode instanceof HTMLInputElement) {
      cloneNode.value = sourceNode.value;
      cloneNode.setAttribute('value', sourceNode.value);
    }
    if (sourceNode instanceof HTMLTextAreaElement && cloneNode instanceof HTMLTextAreaElement) {
      cloneNode.value = sourceNode.value;
      cloneNode.textContent = sourceNode.value;
    }
    if (sourceNode instanceof HTMLCanvasElement && cloneNode instanceof HTMLCanvasElement) {
      try {
        const replacement = document.createElement('img');
        replacement.src = sourceNode.toDataURL('image/png');
        replacement.width = sourceNode.width;
        replacement.height = sourceNode.height;
        replacement.style.width = cloneNode.style.width || `${sourceNode.width}px`;
        replacement.style.height = cloneNode.style.height || `${sourceNode.height}px`;
        cloneNode.replaceWith(replacement);
      } catch {
        cloneNode.replaceWith(document.createElement('div'));
      }
    }
  });
}

export async function renderElementToPngDataUrl(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-export-ignore="true"]').forEach((node) => node.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  clone.style.margin = '0';
  clone.style.transform = 'none';

  inlineDomTree(element, clone);
  await inlineImageSources(element, clone);

  const width = Math.max(element.scrollWidth, element.clientWidth);
  const height = Math.max(element.scrollHeight, element.clientHeight);
  const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));

  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.margin = '0';
  wrapper.style.padding = '0';
  wrapper.style.background = window.getComputedStyle(element).backgroundColor || '#000';
  wrapper.appendChild(clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">${serialized}</foreignObject>
    </svg>
  `;
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (event) => reject(event);
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable');
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportElementAsPng(element: HTMLElement, fileStem: string) {
  const pngUrl = await renderElementToPngDataUrl(element);
  const link = document.createElement('a');
  link.href = pngUrl;
  link.download = `${sanitizeFilePart(fileStem)}.png`;
  link.click();
}
