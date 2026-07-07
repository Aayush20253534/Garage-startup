import { Link } from "react-router-dom";
import Seo from "@/components/seo/Seo";
export default function NotFound() {
  return (
    <>
      <Seo
        title="Page Not Found"
        description="The requested Rovauto page could not be found."
        path={window.location.pathname}
        noIndex
      />

      <div className="container-x py-32 text-center">
      <div className="text-8xl font-extrabold text-brand">404</div>
      <h1 className="text-3xl font-bold mt-4">Page not found</h1>
      <p className="text-muted mt-2">
        The page you're looking for doesn't exist.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Go Home
      </Link>
      </div>
    </>
  );
}
