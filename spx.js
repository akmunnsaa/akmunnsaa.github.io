(async () => {
  const filterFind = 
TDS-A-01,
TDS-A-02,
TDS-A-03,
TDS-A-04,
TDS-A-05,
TDS-A-06,
TDS-A-07,
TDS-A-08,
TDS-A-09,
TDS-A-10,
TDS-A-11,
TDS-A-12,
TDS-A-17,
TDS-B-01,
TDS-B-02,
TDS-B-07,
TDS-B-08,
TDS-B-09,
TDS-C-01,
TDS-D-05,
TDS-D-06,
TDS-D-07,
TDS-D-08,
TDS-D-09,
TDS-D-10
.trim();

  const filterList = filterFind
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  if (typeof XLSX === 'undefined') {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    document.body.appendChild(s);
    await new Promise(r => s.onload = r);
  }

  function scrapeHeader() {
    return [...document.querySelectorAll('.ssc-table-header-title')]
      .map(el => el.textContent.trim());
  }

  function scrapePage() {
    return [...document.querySelectorAll('.ssc-table-body .ssc-table-row')].map(row => {
      const cells = row.querySelectorAll('td');
      const rowData = [...cells].map(cell => {
        const tdContent = cell.querySelector('.td-content');
        if (tdContent) return tdContent.textContent.trim().replace(/\n/g, ' ');
        const sensitive = cell.querySelector('.sensitive-wrap-data');
        if (sensitive) return sensitive.textContent.trim().replace(/\n/g, ' ');
        return cell.textContent.trim().replace(/\n/g, ' ');
      });
      if (rowData[0] === "") rowData.shift();
      return rowData;
    }).filter(row =>
      row.some(cell =>
        filterList.some(keyword => cell.includes(keyword))
      )
    );
  }

  function isNextDisabled() {
    const btn = document.querySelector('.pager-next.pager-step');
    return btn?.classList.contains('pager-step-disabled');
  }

  function clickNext() {
    const btn = document.querySelector('.pager-next.pager-step');
    if (!btn || btn.classList.contains('pager-step-disabled')) return false;
    btn.click();
    return true;
  }

  async function waitForTableChange(prevFirstRowText) {
    return new Promise(resolve => {
      const interval = setInterval(() => {
        const firstRow = document.querySelector('.ssc-table-body .ssc-table-row');
        const newText = firstRow?.innerText.trim();
        if (newText && newText !== prevFirstRowText) {
          clearInterval(interval);
          resolve();
        }
      }, 300);
    });
  }

  async function clickBatchAndWaitAllReveal() {
    const icons = document.querySelectorAll('.ssc-table-body .ssc-table-row svg.sensitive-wrap-icon');
    console.log(🔍 Menemukan ${icons.length} ikon mata. Klik batch...);

    icons.forEach((icon, i) => {
      try {
        icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      } catch (e) {
        console.warn(⚠️ Gagal klik mata ke-${i + 1}, e);
      }
    });

    console.log(⏳ Menunggu semua data sensitif tampil dan tidak mengandung '*'...);

    await new Promise(resolve => {
      const maxWait = 15000;
      const start = Date.now();

      const interval = setInterval(() => {
        const rows = document.querySelectorAll('.ssc-table-body .ssc-table-row');
        let allRevealed = true;

        rows.forEach(row => {
          const sensitiveData = row.querySelectorAll('.sensitive-wrap-data');
          sensitiveData.forEach(el => {
            if (el.textContent.trim().includes('*')) {
              allRevealed = false;
            }
          });
        });

        if (allRevealed) {
          clearInterval(interval);
          console.log('✅ Semua data sensitif sudah terbuka penuh (tanpa bintang).');
          resolve();
        } else if (Date.now() - start > maxWait) {
          clearInterval(interval);
          console.warn('⏰ Timeout: Ada data yang masih mengandung *');
          resolve();
        }
      }, 300);
    });
  }

  const allData = [];
  allData.push(scrapeHeader());

  let page = 1;
  while (true) {
    console.log(📄 Scraping halaman ${page}...);
    await clickBatchAndWaitAllReveal();

    const currentData = scrapePage();
    allData.push(...currentData);

    if (isNextDisabled()) break;

    const firstRow = document.querySelector('.ssc-table-body .ssc-table-row');
    const prevText = firstRow?.innerText.trim() ?? "";

    clickNext();
    await waitForTableChange(prevText);
    page++;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(allData);
  XLSX.utils.book_append_sheet(wb, ws, 'SPX');
  XLSX.writeFile(wb, data_spx_filtered.xlsx);

  console.log(🏁 Selesai export semua data dengan 25 filter SPX zone!);
})();
