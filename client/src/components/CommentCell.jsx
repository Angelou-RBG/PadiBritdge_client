import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addComment, baseURL } from '../services/api';
import FloatingDropdown from './FloatingDropdown';
import './CommentCell.css';

export default function CommentCell({ postId, comment, allComments = [], onCommentAdded }) {
    const { user, isAuthenticated } = useAuth();
    const [isReplying, setIsReplying] = useState(false);
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const replies = allComments.filter(c => c.replying_to === comment.comment_id);
    const pfp = comment?.profile_picture || comment?.profilePicture;

    const dropdownItems = [
        // Empty for now as requested
    ];

    async function handleReplySubmit(event) {
        event.preventDefault();
        if (!isAuthenticated || !user?.id) {
            setError('You must be logged in to reply.');
            return;
        }

        const trimmedContent = content.trim();
        if (!trimmedContent) {
            setError('Reply cannot be empty.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const { comment: newComment } = await addComment(postId, {
                userId: user.id,
                content: trimmedContent,
                replyingTo: comment.comment_id,
            });
            setContent('');
            setIsReplying(false);
            if (newComment && onCommentAdded) {
                onCommentAdded(newComment);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to post reply.');
        } finally {
            setIsSubmitting(false);
        }
    }

    function handleReplyClick() {
        const nextIsReplying = !isReplying;
        setIsReplying(nextIsReplying);
        
        if (nextIsReplying && comment.username) {
            setContent(`@${comment.username} `);
        } else if (!nextIsReplying) {
            setContent('');
            setError('');
        }
    }

    return (
        <div className="comment-cell">
            <div className="comment-cell-main">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    {pfp ? (
                        <img src={`${baseURL}/uploads/${pfp}`} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>👤</div>
                    )}
                    <p className="comment-author" style={{ margin: 0 }}>{comment.full_name || 'Anonymous'}</p>
                    {comment.username && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>@{comment.username}</span>}
                </div>
                <p className="comment-content" style={{ marginTop: '0.25rem' }}>{comment.content}</p>
                <div className="comment-actions">
                    <button type="button" className="primary-btn" onClick={handleReplyClick}>
                        {isReplying ? 'Cancel' : 'Reply'}
                    </button>
                    <FloatingDropdown
                        trigger={<span aria-hidden="true">...</span>}
                        triggerAriaLabel="Comment actions"
                        items={dropdownItems}
                    />
                </div>
            </div>
            {isReplying && (
                <form className="comment-form reply-form" onSubmit={handleReplySubmit}>
                    <input type="text" className="comment-input" value={content} onChange={(e) => setContent(e.target.value)} placeholder={`Replying to ${comment.full_name}...`} disabled={!isAuthenticated || isSubmitting} autoFocus />
                    <button type="submit" className="primary-btn" disabled={!isAuthenticated || isSubmitting}>Send</button>
                    {error && <p className="error-text" style={{ flexBasis: '100%', marginTop: '0.5rem' }}>{error}</p>}
                </form>
            )}
            {replies.length > 0 && (
                <div className="comment-replies">
                    {replies.map(reply => <CommentCell key={reply.comment_id} postId={postId} comment={reply} allComments={allComments} onCommentAdded={onCommentAdded} />)}
                </div>
            )}
        </div>
    );
}