import { Plus, RefreshCw } from 'lucide-react'
import { addDays, captionVariants, withApproval } from '../../../services/campaigns'
import { canApprove } from '../../../services/permissions'
import type { SocialPost } from '../../../types/domain'
import { ChannelMissing, type StageProps } from './shared'

export function SocialsStage({ campaign, department, currentRole, onChange, onActivity }: StageProps) {
  if (!campaign.channels.includes('Social')) {
    return <ChannelMissing campaign={campaign} channel="Social" label="Social media" onChange={onChange} />
  }

  const variants = captionVariants(department, campaign)
  const approvedCount = campaign.socialPosts.filter((post) => post.status !== 'Draft').length

  function updatePosts(posts: SocialPost[], note?: [string, string]) {
    const allApproved = posts.length > 0 && posts.every((post) => post.status !== 'Draft')
    onChange(withApproval({ ...campaign, socialPosts: posts }, 'Socials', allApproved))
    if (note) onActivity(note[0], note[1])
  }

  function editPost(id: string, changes: Partial<SocialPost>) {
    updatePosts(campaign.socialPosts.map((post) => (post.id === id ? { ...post, ...changes, status: 'Draft' } : post)))
  }

  function regenerate(post: SocialPost) {
    const index = variants.indexOf(post.caption)
    const next = variants[(index + 1) % variants.length]
    editPost(post.id, { caption: next })
    onActivity('Caption regenerated', `${post.platform} post now uses a new suggested caption.`)
  }

  function approve(post: SocialPost) {
    updatePosts(
      campaign.socialPosts.map((item) => (item.id === post.id ? { ...item, status: 'Approved' } : item)),
      ['Social post approved', `${post.platform} post on ${post.date} approved.`],
    )
  }

  function addPost() {
    const last = campaign.socialPosts[campaign.socialPosts.length - 1]
    const post: SocialPost = {
      id: crypto.randomUUID(),
      platform: 'Instagram',
      caption: variants[campaign.socialPosts.length % variants.length],
      date: last ? addDays(last.date, 4) : campaign.startDate,
      status: 'Draft',
    }
    updatePosts([...campaign.socialPosts, post], ['Social post added', 'A new Instagram post was added to the sequence.'])
  }

  return (
    <div className="socials-stage">
      <div className="stage-heading">
        <div>
          <h3>Social sequence</h3>
          <p className="muted small">{approvedCount} of {campaign.socialPosts.length} posts approved. Edit a caption to send it back for approval.</p>
        </div>
        <button type="button" className="secondary-button" onClick={addPost}>
          <Plus size={15} /> Add post
        </button>
      </div>

      <div className="post-list">
        {campaign.socialPosts.map((post) => (
          <article className="post-card" key={post.id}>
            <div className="post-image" style={{ backgroundImage: `url(${department.image})` }}>
              <span>{post.platform}</span>
            </div>
            <div className="post-body">
              <div className="post-meta">
                <label>
                  <span>Post date</span>
                  <input type="date" value={post.date} onChange={(event) => editPost(post.id, { date: event.target.value })} />
                </label>
                <em className={`post-status post-status-${post.status.toLowerCase()}`}>{post.status}</em>
              </div>
              <label>
                <span>Caption</span>
                <textarea value={post.caption} onChange={(event) => editPost(post.id, { caption: event.target.value })} />
              </label>
              <div className="post-actions">
                <button type="button" onClick={() => regenerate(post)}>
                  <RefreshCw size={14} /> Regenerate caption
                </button>
                {post.status === 'Draft' && canApprove(currentRole) && (
                  <button type="button" className="approve" onClick={() => approve(post)}>Approve post</button>
                )}
                {post.status === 'Draft' && !canApprove(currentRole) && <span className="muted small">Hotel manager approves</span>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
