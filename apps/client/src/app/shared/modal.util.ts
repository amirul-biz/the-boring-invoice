import Swal from 'sweetalert2';

export async function confirmModal(title: string, description: string): Promise<boolean> {
  const result = await Swal.fire({
    title,
    text: description,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
  });
  return result.isConfirmed;
}

export async function successModal(title: string, description: string): Promise<void> {
  await Swal.fire({
    title,
    text: description,
    icon: 'success',
    confirmButtonText: 'OK',
  });
}

export async function errorModal(title: string, description: string): Promise<void> {
  await Swal.fire({
    title,
    text: description,
    icon: 'error',
    confirmButtonText: 'OK',
  });
}
