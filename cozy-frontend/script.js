const API_BASE = 'https://www.googleapis.com/books/v1/volumes?q=';

const dom = {
  grid: document.getElementById('books-grid'),
  status: document.getElementById('status'),
  form: document.getElementById('search-form'),
  input: document.getElementById('search-input'),
  pills: document.querySelectorAll('.pill')
};

function setStatus(text){
  dom.status.textContent = text;
}

function safeText(str, max = 300){
  if(!str) return '';
  const s = str.replace(/\s+/g,' ').trim();
  if(s.length <= max) return s;
  return s.slice(0,max).trim() + '…';
}

function createCard(item){
  const info = item.volumeInfo || {};
  const title = info.title || 'Untitled';
  const authors = (info.authors || []).join(', ') || 'Unknown author';
  const desc = safeText(info.description || info.subtitle || '', 220);
  const link = info.infoLink || info.previewLink || '#';
  const thumb = (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) || null;

  const card = document.createElement('article');
  card.className = 'book-card';

  const coverWrap = document.createElement('div');
  coverWrap.className = 'book-cover-wrap';
  const img = document.createElement('img');
  img.className = 'book-cover';
  img.alt = `${title} cover`;
  if(thumb){
    img.src = thumb.replace(/^http:/,'https:');
  } else {
    img.src = placeholderDataURL(title);
  }
  coverWrap.appendChild(img);

  const infoWrap = document.createElement('div');
  infoWrap.className = 'book-info';
  const h3 = document.createElement('h3');
  h3.className = 'book-title';
  h3.textContent = title;
  const pAuth = document.createElement('p');
  pAuth.className = 'book-authors';
  pAuth.textContent = authors;
  const pDesc = document.createElement('p');
  pDesc.className = 'book-desc';
  pDesc.textContent = desc;

  const footer = document.createElement('div');
  footer.className = 'card-footer';
  const a = document.createElement('a');
  a.className = 'view-link';
  a.href = link;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = 'View on Google Books';

  footer.appendChild(a);

  infoWrap.appendChild(h3);
  infoWrap.appendChild(pAuth);
  infoWrap.appendChild(pDesc);
  infoWrap.appendChild(footer);

  card.appendChild(coverWrap);
  card.appendChild(infoWrap);

  return card;
}

function placeholderDataURL(title){
  const bg = '%23F6EDE6';
  const fg = '%23655b57';
  const text = encodeURIComponent(title.slice(0,12));
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='300'><rect width='100%' height='100%' fill='${bg}'/><text x='50%' y='50%' font-family='Merriweather, serif' font-size='18' fill='${fg}' text-anchor='middle' dominant-baseline='middle'>${text}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + svg;
}

async function fetchBooks(query){
  try{
    setStatus('Searching...');
    dom.grid.innerHTML = '';
    const url = API_BASE + encodeURIComponent(query) + '&maxResults=24';
    const res = await fetch(url);
    if(!res.ok) throw new Error('Network response not ok');
    const data = await res.json();
    const items = data.items || [];
    if(items.length === 0){
      setStatus('No results. Try another search.');
      return;
    }
    renderBooks(items);
    setStatus(`Showing ${items.length} results`);
  }catch(err){
    console.error(err);
    setStatus('Could not fetch books. Try again later.');
  }
}

function renderBooks(items){
  dom.grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  items.forEach(item =>{
    const card = createCard(item);
    frag.appendChild(card);
  });
  dom.grid.appendChild(frag);
}

// event handlers
function onSearch(e){
  e.preventDefault();
  const q = dom.input.value.trim();
  if(!q) return fetchBooks('bestsellers');
  fetchBooks(q);
}

function onPillClick(e){
  const q = e.currentTarget.getAttribute('data-query') || '';
  if(q) fetchBooks(q);
  else fetchBooks('bestsellers');
}

dom.form.addEventListener('submit', onSearch);
dom.pills.forEach(p=>p.addEventListener('click', onPillClick));

// initial load
fetchBooks('bestsellers');

// accessibility: allow Enter on input to submit
dom.input.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') dom.form.dispatchEvent(new Event('submit', {cancelable:true}));
});
