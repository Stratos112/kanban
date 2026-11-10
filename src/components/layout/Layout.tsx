import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import styles from './Layout.module.css'

interface Props {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  return (
    <div className={styles.root}>
      <Sidebar />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
