import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addComment } from '../services/api';
import FloatingDropdown from './FloatingDropdown';
import './CommentCell.css';

export default function CommentCell({ postId, comment, allComments = [], onCommentAdded }) {
    const { user, isAuthenticated } = useAuth();
    const [isReplying, setIsReplying] = useState(false);
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const replies = allComments.filter(c => c.replying_to === comment.comment_id);

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

    return (
        <div className="comment-cell">
            <div className="comment-cell-main">
                <p className="comment-author">{comment.full_name || 'Anonymous'}</p>
                <p className="comment-content">{comment.content}</p>
                <div className="comment-actions">
                    <button type="button" className="primary-btn" onClick={() => setIsReplying(!isReplying)}>
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