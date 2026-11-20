// The private Sites library entry opens the same live island as the residency invitation.
export default {
  fetch(request,env) {
    if(!env.COURTYARD_INVITATION_URL)return new Response('The island invitation is being prepared.',{status:503});
    return new Response(null,{status:302,headers:{Location:env.COURTYARD_INVITATION_URL,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
  }
};
