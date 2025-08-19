import { redirect } from 'next/navigation'

export default function OldPatientsPage() {
  redirect('/dashboard/patients')
}