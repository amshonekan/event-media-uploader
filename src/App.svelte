<script lang="ts">
  import { checkAuthorisation, formatBytes, uploadItem } from './lib/upload';
  import type { IUploadItem } from './lib/types';
  // import Timeline from './lib/Timeline.svelte';
  import IconButton from '@smui/button';
  import LinearProgress from '@smui/linear-progress';
  import SvgIcon from '@jamescoyle/svelte-icon';
  import { mdiImage, mdiVideo } from '@mdi/js';
  import { Timeline, TimelineItem } from "flowbite-svelte";

  const uploadSteps = [
    { title: 'Choose your memories', description: 'Add photos and videos from the celebration', opposite: 'Step 1', color: 'primary' as const },
    { title: 'Enter the event code', description: 'Your code keeps the album private', opposite: 'Step 2', color: 'secondary' as const },
    { title: 'Share with the couple', description: 'Your files will be uploaded securely', opposite: 'Step 3', color: 'success' as const },
  ]

  let items: IUploadItem[] = []
  let passcode = ''
  let statusText = ''
  let statusKind = ''
  let isUploading = false
  let isAuthorised = false

  checkAuthorisation().then((authorised) => { isAuthorised = authorised })

  $: queuedCount = items.filter((item) => item.status === 'queued').length
  $: failedCount = items.filter((item) => item.status === 'error').length

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const newItems = Array.from(fileList)
      .filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))
      .map((file) => ({ id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, file, status: 'queued' as const, progress: 0, message: formatBytes(file.size) }))
    items = [...items, ...newItems].slice(0, 50)
  }

  function removeFile(id: string) {
    items = items.filter((item) => item.id !== id)
  }

  async function uploadFiles() {
    isUploading = true
    statusText = 'Preparing your private upload…'
    statusKind = ''
    for (const item of items) {
      if (item.status !== 'queued') continue
      updateItem(item.id, { status: 'uploading', progress: 0 })
      try {
        await uploadItem(item, passcode.trim(), (progress) => updateItem(item.id, { progress }), () => { isAuthorised = true; passcode = '' })
        updateItem(item.id, { status: 'complete', progress: 100 })
      } catch (error) {
        updateItem(item.id, { status: 'error', message: error instanceof Error ? error.message : 'Upload failed. Please try again.' })
      }
    }
    isUploading = false
    statusText = failedCount ? `${failedCount} file${failedCount === 1 ? '' : 's'} need another try.` : 'Everything is safely on its way. Thank you for adding to the story.'
    statusKind = failedCount ? 'error' : 'success'
  }

  function updateItem(id: string, changes: Partial<IUploadItem>) {
    items = items.map((item) => item.id === id ? { ...item, ...changes } : item)
  }
</script>

<svelte:head><meta name="description" content="Share photos and videos from the celebration!" /></svelte:head>

<main class="page-shell">
  <header class="topbar"><span>Raimi Wedding Media Album</span></header>
  <section class="hero">
    <p class="eyebrow">Thank you for celebrating with us</p>
    <p class="intro">Please share all your lovely <b>photos</b> and <b>videos</b> from the celebration for the couple to keep.</p>
  </section>
  <section id="upload-panel" class="upload-layout" aria-labelledby="upload-title">
    <aside>
      <Timeline items={uploadSteps} />
    </aside>
    <div>
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Media drop</p>
          <h2 id="upload-title">Add your files here</h2>
        </div>
        <span class="file-count">{items.length} file{items.length === 1 ? '' : 's'}</span>
      </div>
      <label class="dropzone" for="file-input" on:dragover|preventDefault on:drop|preventDefault={(event) => addFiles(event.dataTransfer?.files ?? null)}>
        <input id="file-input" type="file" accept="image/*,video/*" multiple on:change={(event) => addFiles(event.currentTarget.files)}>
        <span class="upload-icon" aria-hidden="true">↑</span>
        <strong>Tap to choose photos & videos</strong>
        <span>or drag and drop them here</span>
        <small>JPG, PNG, HEIC, MP4 and MOV · up to 2 GB each</small>
      </label>
      {#if isAuthorised}
        <p class="authorised-note">✓ This device is verified for the event</p>
      {:else}
        <label class="passcode-field">Event code <input type="text" bind:value={passcode} autocomplete="off" placeholder="Enter once to continue"></label>
      {/if}
      <div class="upload-list" aria-live="polite">
        {#each items as item (item.id)}
          <div class="file-row {item.status}"><div class="file-type">
          {#if item.file.type.startsWith('video/')}
            <SvgIcon type="mdi" path={mdiVideo}></SvgIcon>
          {:else}
            <SvgIcon type="mdi" path={mdiImage}></SvgIcon>
          {/if}
          </div><div class="file-meta"><strong>{item.file.name}</strong><span>{item.status === 'uploading' ? `${item.progress}% uploading` : item.message}</span>{#if item.status === 'uploading'}<LinearProgress progress={item.progress / 100} />{/if}</div>{#if item.status === 'queued'}<IconButton class="remove-file" type="button" onclick={() => removeFile(item.id)} aria-label={`Remove ${item.file.name}`}>×</IconButton>{:else}<span class="file-state">{item.status === 'complete' ? '✓' : item.status === 'error' ? '!' : `${item.progress}%`}</span>{/if}</div>
        {/each}
      </div>
      <button class="primary-button" type="button" disabled={!queuedCount || isUploading} on:click={uploadFiles}>Upload selected files</button>
      <p class="status-message {statusKind}" role="status">{failedCount ? `${failedCount} file${failedCount === 1 ? '' : 's'} need another try.` : statusText}</p>
    </div>
  </section>
  <footer class="footer">
    <span>Chelsea & Nathaniel thank you for attending and sharing your photos and videos with them</span>
    <span>⚡️ Powered by Dev Magic</span>
  </footer>
</main>

