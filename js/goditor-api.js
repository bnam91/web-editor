/**
 * Goditor API — Declarative section builder
 * window.goditor.buildSection(spec) 으로 Spec v2 JSON → 에디터 섹션 자동 조립
 *
 * 사용법:
 *   window.goditor.buildSection(sectionSpec)   // 섹션 1개 조립
 *   window.goditor.buildFromSpec(goditorSpec)   // 전체 Spec v2 실행
 */

window.goditor = {

  /**
   * Goditor Spec v2 전체 실행
   * @param {Object} spec - { schema, version, sections: [...] }
   */
  buildFromSpec(spec) {
    if (!spec || !Array.isArray(spec.sections)) {
      console.error('[goditor] Invalid spec: sections 배열 없음');
      return;
    }
    for (const section of spec.sections) {
      this.buildSection(section);
    }
  },

  /**
   * 섹션 1개 조립
   * @param {Object} section - { label, settings, rows: [...] }
   */
  buildSection(section) {
    // 1. 섹션 생성
    const sectionOpts = { skipDefaultBlock: true };
    if (section.settings?.bg) sectionOpts.bg = section.settings.bg;
    window.addSection(sectionOpts);

    // 2. 각 row 처리
    for (const row of (section.rows || [])) {
      this._buildRow(row);
    }

    // 3. 저장
    window.triggerAutoSave();
  },

  /**
   * row 1개 처리
   * @param {Object} row - { layout, cols, gridCols, gridRows }
   */
  _buildRow(row) {
    const layout = row.layout || 'stack';
    const cols = row.cols || [];

    if (layout === 'stack') {
      // 단일 열 — col-active 없이 바로 블록 추가
      const col = cols[0];
      if (col) {
        for (const block of (col.blocks || [])) {
          this._addBlock(block);
        }
      }
      return;
    }

    // flex / grid → stack fallback (NewGrid Frame 봉인 2026-06-08)
    // 사용자 정책: ss_* Grid 블록 deprecated. 외부 API에서 multi-col 요청 와도 stack으로 처리.
    console.warn('[goditor] flex/grid row 요청 — stack으로 fallback (NewGrid Frame deprecated)');
    for (const col of cols) {
      for (const block of (col.blocks || [])) {
        this._addBlock(block);
      }
    }
  },

  /**
   * 블록 1개 추가
   * @param {Object} block - { type, ... }
   */
  _addBlock(block) {
    switch (block.type) {
      case 'text':
        window.addTextBlock(block.style || 'body', {
          content: block.content,
          align: block.align,
          color: block.color,
          fontSize: block.fontSize,
        });
        break;

      case 'image':
        window.addAssetBlock(block.preset || 'standard', {
          ...(block.paddingX !== undefined && { paddingX: block.paddingX }),
          ...(block.width    !== undefined && { width:    block.width }),
          ...(block.height   !== undefined && { height:   block.height }),
        });
        break;

      case 'gap':
        window.addGapBlock(block.height);
        break;

      case 'divider':
        window.addDividerBlock({
          color: block.color,
          lineStyle: block.lineStyle,
          weight: block.weight,
        });
        break;

      case 'icon-circle':
        window.addIconCircleBlock({
          size: block.size,
          bgColor: block.bgColor,
        });
        break;

      case 'label-group':
        window.addLabelGroupBlock({
          labels: block.labels,
        });
        break;

      case 'table':
        window.addTableBlock({
          showHeader: block.showHeader,
          cellAlign: block.cellAlign,
        });
        break;

      case 'card': {
        // card-block(cdb)은 중앙패널에서 제거됨 + 타입목록 누락으로 편집/삭제 버그 다수 →
        // 자동조립도 canvas-block(cvb) simple 카드로 통일. count장을 가로 그리드로.
        const _cardN = Math.max(1, parseInt(block.count) || 1);
        window.addCanvasBlock({
          cardMode: 'simple',
          gridCols: _cardN,
          gridRows: 1,
          ...(block.radius  !== undefined && { radius: block.radius }),
          ...(block.bgColor !== undefined && { textBg: block.bgColor }),
          cards: Array.from({ length: _cardN }, () => ({ title: '카드 제목', desc: '', imgSrc: '', cellBg: '' })),
        });
        break;
      }

      case 'graph':
        window.addGraphBlock({
          chartType: block.chartType,
          items: block.items,
        });
        break;

      default:
        console.warn('[goditor] 알 수 없는 블록 타입:', block.type);
    }
  },
};
