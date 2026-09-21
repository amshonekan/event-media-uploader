<script lang="ts">
  type TimelineColor = 'primary' | 'secondary' | 'success' | 'warning'

  interface TimelineItem {
    title: string
    description?: string
    opposite?: string
    color?: TimelineColor
    completed?: boolean
  }

  export let items: TimelineItem[] = []
  export let position: 'left' | 'right' | 'alternate' = 'right'
</script>

<ol class:alternate={position === 'alternate'} class="timeline" aria-label="Upload steps">
  {#each items as item, index (item.title)}
    <li class:completed={item.completed} class="timeline-item">
      {#if position !== 'right'}
        <span class="opposite-content">{item.opposite ?? ''}</span>
      {/if}

      <div class="separator" aria-hidden="true">
        <span class="dot {item.color ?? 'primary'}">{item.completed ? '✓' : index + 1}</span>
        {#if index < items.length - 1}
          <span class="connector"></span>
        {/if}
      </div>

      <div class="content">
        <strong>{item.title}</strong>
        {#if item.description}
          <span>{item.description}</span>
        {/if}
        {#if position === 'right' && item.opposite}
          <small>{item.opposite}</small>
        {/if}
      </div>
    </li>
  {/each}
</ol>

<style>
  .timeline {
    --timeline-axis: #d9cce4;
    --timeline-text: #6b6375;
    --timeline-heading: #08060d;
    list-style: none;
    margin: 0;
    padding: 8px 0;
  }

  .timeline-item {
    display: grid;
    grid-template-columns: 1fr 32px 1fr;
    min-height: 76px;
    align-items: start;
  }

  .separator {
    display: flex;
    min-height: 76px;
    align-items: center;
    flex-direction: column;
  }

  .dot {
    z-index: 1;
    display: grid;
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    place-items: center;
    border: 3px solid var(--bg, #fff);
    border-radius: 50%;
    color: #fff;
    background: #aa3bff;
    box-shadow: 0 0 0 1px #aa3bff;
    font-size: 12px;
    font-weight: 700;
  }

  .dot.secondary { background: #7c4dff; box-shadow: 0 0 0 1px #7c4dff; }
  .dot.success { background: #218739; box-shadow: 0 0 0 1px #218739; }
  .dot.warning { background: #b96b00; box-shadow: 0 0 0 1px #b96b00; }

  .connector {
    width: 2px;
    flex: 1;
    background: var(--timeline-axis);
  }

  .content,
  .opposite-content {
    padding: 3px 12px;
    color: var(--timeline-text);
    font-size: 14px;
    line-height: 1.4;
  }

  .content strong {
    display: block;
    color: var(--timeline-heading);
    font-size: 15px;
  }

  .content span,
  .content small {
    display: block;
  }

  .content small,
  .opposite-content {
    color: var(--timeline-text);
    font-size: 12px;
  }

  .timeline-item > .content {
    grid-column: 3;
  }

  .timeline-item > .opposite-content {
    grid-column: 1;
    grid-row: 1;
    text-align: right;
  }

  .timeline.alternate .timeline-item:nth-child(even) > .content {
    grid-column: 1;
    grid-row: 1;
    text-align: right;
  }

  .timeline.alternate .timeline-item:nth-child(even) > .opposite-content {
    grid-column: 3;
    text-align: left;
  }

  @media (prefers-color-scheme: dark) {
    .dot { border-color: var(--bg, #16171d); }
  }
</style>
