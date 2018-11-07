import {
  WorkingDirectoryStatus,
  WorkingDirectoryFileChange,
} from '../../../models/status'
import { IStatusResult } from '../../git'
import { IChangesState } from '../../app-state'
import { DiffSelectionType } from '../../../models/diff'
import { caseInsensitiveCompare } from '../../compare'

// TODO: I want to use generics here so I don't need to hard-code the keys

export function updateChangedFiles(
  status: IStatusResult,
  clearPartialState: boolean,
  state: IChangesState
): Pick<IChangesState, 'workingDirectory' | 'selectedFileIDs' | 'diff'> {
  // Populate a map for all files in the current working directory state
  const filesByID = new Map<string, WorkingDirectoryFileChange>()
  state.workingDirectory.files.forEach(f => filesByID.set(f.id, f))

  // Attempt to preserve the selection state for each file in the new
  // working directory state by looking at the current files
  const mergedFiles = status.workingDirectory.files
    .map(file => {
      const existingFile = filesByID.get(file.id)
      if (existingFile) {
        if (clearPartialState) {
          if (
            existingFile.selection.getSelectionType() ===
            DiffSelectionType.Partial
          ) {
            return file.withIncludeAll(false)
          }
        }

        return file.withSelection(existingFile.selection)
      } else {
        return file
      }
    })
    .sort((x, y) => caseInsensitiveCompare(x.path, y.path))

  // Collect all the currently available file ids into a set to avoid O(N)
  // lookups using .find on the mergedFiles array.
  const mergedFileIds = new Set(mergedFiles.map(x => x.id))

  // The previously selected files might not be available in the working
  // directory any more due to having been committed or discarded so we'll
  // do a pass over and filter out any selected files that aren't available.
  let selectedFileIDs = state.selectedFileIDs.filter(id =>
    mergedFileIds.has(id)
  )

  // Select the first file if we don't have anything selected and we
  // have something to select.
  if (selectedFileIDs.length === 0 && mergedFiles.length > 0) {
    selectedFileIDs = [mergedFiles[0].id]
  }

  // The file selection could have changed if the previously selected files
  // are no longer selectable (they were discarded or committed) but if they
  // were not changed we can reuse the diff. Note, however that we only render
  // a diff when a single file is selected. If the previous selection was
  // a single file with the same id as the current selection we can keep the
  // diff we had, if not we'll clear it.
  const workingDirectory = WorkingDirectoryStatus.fromFiles(mergedFiles)

  const diff =
    selectedFileIDs.length === 1 &&
    state.selectedFileIDs.length === 1 &&
    state.selectedFileIDs[0] === selectedFileIDs[0]
      ? state.diff
      : null

  return {
    workingDirectory,
    selectedFileIDs,
    diff,
  }
}
