import { spawn } from 'node:child_process'
import { shell } from 'electron'
import { getSettings } from '../db/database'

export function openInBambuStudio(filePath: string): void {
  const { bambuStudioPath } = getSettings()
  if (bambuStudioPath) {
    if (process.platform === 'darwin' && bambuStudioPath.endsWith('.app')) {
      spawn('open', ['-a', bambuStudioPath, filePath], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn(bambuStudioPath, [filePath], { detached: true, stdio: 'ignore' }).unref()
    }
    return
  }
  // Fall back to the OS default handler for the file type.
  void shell.openPath(filePath)
}
