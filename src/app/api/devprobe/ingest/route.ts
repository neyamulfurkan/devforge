// This API route file is deprecated.
// All functionality has been moved to src/hooks/useProject.ts
// This file should be deleted.

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use the client-side hook instead.' },
    { status: 410 }
  )
}
  const queryClient = useQueryClient()
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const updateFileStatusInStore = useProjectStore((s) => s.updateFileStatus)
  const {
    data: project,
    isLoading,
    error,
    refetch,
  } = useQuery<Project, Error>({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId),
    enabled: Boolean(projectId),
    staleTime: 10_000,
  })
  // Sync fetched project into global store
  useEffect(() => {
    if (project) {
      setCurrentProject(project.id, project)
    }
  }, [project, setCurrentProject])
  const updateStatusMutation = useMutation<Project, Error, UpdateStatusParams>({
    mutationFn: (params) => patchProject(projectId, params),
    onSuccess: (updatedProject) => {
      queryClient.setQueryData<Project>(['project', projectId], updatedProject)
      setCurrentProject(updatedProject.id, updatedProject)
    },
  })
  const updateFileMutation = useMutation<void, Error, UpdateFileParams>({
    mutationFn: ({ fileId, updates }) => patchFile(projectId, fileId, updates),
    onMutate: ({ fileId, updates }) => {
      // Optimistic update for file status changes
      if (updates.status) {
        updateFileStatusInStore(fileId, updates.status)
      }
    },
    onSettled: () => {
      // Revalidate file list after mutation settles
      queryClient.invalidateQueries({ queryKey: ['files', projectId] })
    },
  })
  return {
    project: project ?? null,
    isLoading,
    error,
    refetch,
    updateStatus: (params: UpdateStatusParams) => updateStatusMutation.mutate(params),
    updateFile: (params: UpdateFileParams) => updateFileMutation.mutate(params),
    isUpdatingStatus: updateStatusMutation.isPending,
    isUpdatingFile: updateFileMutation.isPending,
  }
}