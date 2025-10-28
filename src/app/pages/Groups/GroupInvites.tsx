// src/app/pages/GroupInvites.tsx
import React, { useEffect, useState, useContext } from "react";
import { UserContext } from "../context/UserContext";
import axios from "axios";

export default function GroupInvites() {
    const { user } = useContext(UserContext);
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        axios.get(`/api/group-invites/${user.id}/`).then(res => {
            setInvites(res.data);
            setLoading(false);
        });
    }, [user]);

    const respond = (inviteId: number, accept: boolean) => {
        axios.post(`/api/groups/invite/respond/${inviteId}/`, { accept })
            .then(() => setInvites(invites.filter(i => i.id !== inviteId)));
    };

    if (loading) return <div>Loading...</div>;
    if (invites.length === 0) return <div>No group invites.</div>;

    return (
        <div>
            <h2>Group Invitations</h2>
            <ul>
                {invites.map(invite => (
                    <li key={invite.id}>
                        <b>{invite.group_name}</b> (invited by {invite.sender_name})
                        <button onClick={() => respond(invite.id, true)}>Accept</button>
                        <button onClick={() => respond(invite.id, false)}>Decline</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}